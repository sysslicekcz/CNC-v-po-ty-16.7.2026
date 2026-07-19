import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { ReleasedRoutingSheetSnapshotRepository } from "@/domain/repositories/released-routing-sheet-snapshot-repository";
import { PartRepository } from "@/domain/repositories/part-repository";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { ToolRepository } from "@/domain/repositories/tool-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { ReleasedRoutingSheetSnapshot } from "@/domain/aggregates/routing-sheet/released-snapshot";
import { RoutingSheetValidationError } from "./errors";
import { ValidateRoutingSheetUseCase } from "./validate-routing-sheet-use-case";
import { buildReleasedRoutingSheetSnapshot } from "./released-snapshot-builder";

export interface ReleaseRoutingSheetCommand {
  routingSheetId: string;
  releasedBy?: string;
}

/**
 * Vydání technologického postupu (Krok 4, zadání bod 27) - postup přesně podle
 * zadání:
 *  1. ověřit aktivního tenanta (TenantContext),
 *  2. ověřit licenci routing.release,
 *  3. načíst draft,
 *  4. ověřit tenant scope (findById už to dělá - cizí tenant = NotFoundError),
 *  5. ověřit stav draft,
 *  6. provést release validaci (přísnější než draft - viz ValidateRoutingSheetUseCase),
 *  7. vytvořit immutable vydaný stav (RoutingSheet.release() + snapshot),
 *  8. uložit (RoutingSheet i ReleasedRoutingSheetSnapshot),
 *  9. vrátit vydaný postup (snapshot).
 *
 * Při chybě validace se NEPROVÁDÍ částečný release - `RoutingSheetValidationError`
 * se vyhodí PŘED jakoukoliv mutací/zápisem.
 */
export class ReleaseRoutingSheetUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly releasedSnapshotRepository: ReleasedRoutingSheetSnapshotRepository,
    private readonly partRepository: PartRepository,
    private readonly machineRepository: MachineRepository,
    private readonly externalResourceRepository: ExternalOperationResourceRepository,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly toolRepository: ToolRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly validateRoutingSheetUseCase: ValidateRoutingSheetUseCase = new ValidateRoutingSheetUseCase()
  ) {}

  async execute(command: ReleaseRoutingSheetCommand): Promise<ReleasedRoutingSheetSnapshot> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingRelease, "write");

    const routingSheet = await this.routingSheetRepository.findById(command.routingSheetId, tenantId);
    if (!routingSheet) throw new NotFoundError("RoutingSheet", command.routingSheetId);
    if (routingSheet.stav !== "draft") {
      throw new InvalidStateError(`Nelze vydat postup ve stavu "${routingSheet.stav}" - vydat lze jen draft.`);
    }

    const part = await this.partRepository.findById(routingSheet.partId);
    if (!part) throw new NotFoundError("Part", routingSheet.partId);

    const [machines, externalResources, operationTypes, tools] = await Promise.all([
      this.machineRepository.list(tenantId),
      this.externalResourceRepository.list(tenantId),
      this.operationTypeRepository.list(tenantId),
      this.toolRepository.list(tenantId),
    ]);
    const machinesById = new Map<string, Machine>(machines.map((m) => [m.id, m]));
    const externalResourcesById = new Map<string, ExternalOperationResource>(externalResources.map((r) => [r.id, r]));
    const operationTypesById = new Map<string, OperationType>(operationTypes.map((t) => [t.id, t]));
    const toolsById = new Map(tools.map((t) => [t.id, t]));

    const issues = this.validateRoutingSheetUseCase.execute({
      routingSheet,
      machinesById,
      externalResourcesById,
      operationTypesById,
    });
    const blockingIssues = issues.filter((issue) => issue.severity === "error");
    if (blockingIssues.length > 0) {
      throw new RoutingSheetValidationError(blockingIssues);
    }

    const releasedAt = new Date();
    routingSheet.release(releasedAt, command.releasedBy);

    const snapshot = buildReleasedRoutingSheetSnapshot(
      routingSheet,
      part,
      { machinesById, externalResourcesById, operationTypesById, toolsById },
      releasedAt,
      command.releasedBy
    );

    await this.routingSheetRepository.save(routingSheet);
    await this.releasedSnapshotRepository.save(snapshot);

    return snapshot;
  }
}
