import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { PartRepository } from "@/domain/repositories/part-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { RoutingSheetDraftAlreadyExistsError } from "./errors";

export interface CreateRoutingSheetCommand {
  partId: string;
  name?: string;
  description?: string;
}

/**
 * Založení nového technologického postupu (Krok 4, zadání bod 35) - vždy
 * revize 1 (nebo první revize BEZ draftu, pokud díl už má jen vydané/archivované
 * postupy - viz `getNextRevisionNumber`). Nejvýš jeden draft na díl současně
 * (`RoutingSheetDraftAlreadyExistsError`) - pro úpravu vydaného postupu slouží
 * `CreateRoutingSheetRevisionUseCase`, ne tenhle use case.
 *
 * `tenant scope dílu` (zadání bod 35) se dnes NEOVĚŘUJE - `Part` nemá `tenantId`
 * (vědomě odložené rozšíření, viz docs/audits/step-4-audit.md a
 * docs/adr/0019) - jen se ověří, že díl vůbec existuje.
 */
export class CreateRoutingSheetUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly partRepository: PartRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(command: CreateRoutingSheetCommand): Promise<RoutingSheet> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingEdit, "write");

    const part = await this.partRepository.findById(command.partId);
    if (!part) throw new NotFoundError("Part", command.partId);

    const existingDraft = await this.routingSheetRepository.findDraftByPartId(tenantId, command.partId);
    if (existingDraft) {
      throw new RoutingSheetDraftAlreadyExistsError(command.partId, existingDraft.id);
    }

    const activeCount = (await this.routingSheetRepository.list(tenantId)).filter((rs) => rs.stav !== "archived").length;
    await this.featureAccessService.assertWithinLimit("routingSheets.active.max", activeCount + 1);

    const revision = await this.routingSheetRepository.getNextRevisionNumber(tenantId, command.partId);

    const routingSheet = RoutingSheet.create({
      id: crypto.randomUUID(),
      tenantId,
      partId: command.partId,
      nazev: command.name?.trim() || `Technologický postup - revize ${revision}`,
      popis: command.description,
      verze: String(revision),
      stav: "draft",
      isDefault: revision === 1,
      createdAt: Date.now(),
    });

    await this.routingSheetRepository.save(routingSheet);
    return routingSheet;
  }
}
