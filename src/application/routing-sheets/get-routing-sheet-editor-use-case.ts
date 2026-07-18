import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
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
import { RoutingSheetEditorDto } from "./dto/routing-sheet-editor-dto";
import { toRoutingSheetEditorDto } from "./routing-sheet-editor-mapper";
import { ValidateRoutingSheetUseCase } from "./validate-routing-sheet-use-case";

/**
 * Načte draft/vydaný postup a sestaví editor DTO (Krok 4, zadání bod 43).
 * Neexistující id NEBO id patřící jinému tenantovi se chová STEJNĚ (`NotFoundError`) -
 * appka nikdy neprozradí existenci cizích dat (zadání bod 32).
 *
 * Číselníky (Machine/ExternalOperationResource/OperationType/Tool) se natáhnou
 * dávkově přes `findAll`/`list`, ne dotazem za každou operaci/činnost zvlášť
 * (zadání bod 48). `ToolRepository`/`OperationTypeRepository` nejsou
 * tenant-scoped (známé omezení, viz docs/audits/step-4-audit.md) - `Machine`/
 * `ExternalOperationResource` ano.
 */
export class GetRoutingSheetEditorUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly partRepository: PartRepository,
    private readonly machineRepository: MachineRepository,
    private readonly externalResourceRepository: ExternalOperationResourceRepository,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly toolRepository: ToolRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly validateRoutingSheetUseCase: ValidateRoutingSheetUseCase = new ValidateRoutingSheetUseCase()
  ) {}

  async execute(routingSheetId: string): Promise<RoutingSheetEditorDto> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingView, "read");

    const routingSheet = await this.routingSheetRepository.findById(routingSheetId, tenantId);
    if (!routingSheet) throw new NotFoundError("RoutingSheet", routingSheetId);

    const part = await this.partRepository.findById(routingSheet.partId);
    if (!part) throw new NotFoundError("Part", routingSheet.partId);

    const [machines, externalResources, operationTypes, tools] = await Promise.all([
      this.machineRepository.list(tenantId),
      this.externalResourceRepository.list(tenantId),
      this.operationTypeRepository.findAll(),
      this.toolRepository.findAll(),
    ]);

    const machinesById = new Map<string, Machine>(machines.map((m) => [m.id, m]));
    const externalResourcesById = new Map<string, ExternalOperationResource>(externalResources.map((r) => [r.id, r]));
    const operationTypesById = new Map<string, OperationType>(operationTypes.map((t) => [t.id, t]));
    const toolsById = new Map(tools.map((t) => [t.id, t]));

    const validationIssues = this.validateRoutingSheetUseCase.execute({
      routingSheet,
      machinesById,
      externalResourcesById,
      operationTypesById,
    });

    return toRoutingSheetEditorDto(
      routingSheet,
      part,
      { machinesById, externalResourcesById, operationTypesById, toolsById },
      validationIssues
    );
  }
}
