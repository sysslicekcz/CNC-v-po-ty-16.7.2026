import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { RoutingSheetDraftAlreadyExistsError } from "./errors";
import { cloneRoutingSheetAsNewDraft } from "./routing-sheet-cloner";

export interface DuplicateRoutingSheetCommand {
  sourceRoutingSheetId: string;
  name?: string;
}

/**
 * Založí nový draft jako kopii existujícího postupu (Krok 4, zadání bod 36) -
 * na rozdíl od `CreateRoutingSheetRevisionUseCase` funguje nad postupem
 * v LIBOVOLNÉM stavu (draft/released/archived) a zdroj se NEARCHIVUJE (jde o
 * "začni od podobného postupu", ne o formální revizní workflow). Cílový díl je
 * vždy stejný jako u zdroje - kopírování MEZI díly není v tomhle kroku
 * podporované (mimo rozsah zadání). Duplikát NENÍ "výchozí" (`isDefault`
 * zůstává na cloneru výchozí `false`) - zdroj si příznak podrží beze změny,
 * protože duplikace zdroj formálně nenahrazuje.
 */
export class DuplicateRoutingSheetUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(command: DuplicateRoutingSheetCommand): Promise<RoutingSheet> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingEdit, "write");

    const source = await this.routingSheetRepository.findById(command.sourceRoutingSheetId, tenantId);
    if (!source) throw new NotFoundError("RoutingSheet", command.sourceRoutingSheetId);

    const existingDraft = await this.routingSheetRepository.findDraftByPartId(tenantId, source.partId);
    if (existingDraft) {
      throw new RoutingSheetDraftAlreadyExistsError(source.partId, existingDraft.id);
    }

    const activeCount = (await this.routingSheetRepository.list(tenantId)).filter((rs) => rs.stav !== "archived").length;
    await this.featureAccessService.assertWithinLimit("routingSheets.active.max", activeCount + 1);

    const revision = await this.routingSheetRepository.getNextRevisionNumber(tenantId, source.partId);
    const duplicate = cloneRoutingSheetAsNewDraft(source, {
      newId: crypto.randomUUID(),
      tenantId,
      revision,
      createdAt: Date.now(),
      name: command.name,
    });

    await this.routingSheetRepository.save(duplicate);
    return duplicate;
  }
}
