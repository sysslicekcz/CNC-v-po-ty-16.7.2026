import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { RoutingSheetDraftAlreadyExistsError } from "./errors";
import { cloneRoutingSheetAsNewDraft } from "./routing-sheet-cloner";

export interface CreateRoutingSheetRevisionCommand {
  sourceRoutingSheetId: string;
}

/**
 * Vytvoří novou draft revizi z VYDANÉHO postupu (Krok 4, zadání bod 4) - jediný
 * způsob, jak "upravit" released revizi. Zdrojová revize se při vzniku nové
 * archivuje (`RoutingSheet.archive()`) - "archived" = "obsolete" ze zadání,
 * historická revize, která už není aktuální (viz docs/adr/new-revision-instead-of-editing-release.md,
 * ARCHITEKTONICKÉ ROZHODNUTÍ zdokumentované tam: archivace proběhne hned při
 * založení nové revize, ne až při jejím vydání - jinak by mohly krátkodobě
 * existovat dvě "released" revize současně). Zdroj zároveň přijde o příznak
 * "výchozí" (`source.clearDefault()`) - nová revize ho dostane MÍSTO něj
 * (`cloneRoutingSheetAsNewDraft({ isDefault: true })`), aby měl díl vždy
 * nejvýš jednu výchozí RoutingSheet.
 */
export class CreateRoutingSheetRevisionUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(command: CreateRoutingSheetRevisionCommand): Promise<RoutingSheet> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingEdit, "write");

    const source = await this.routingSheetRepository.findById(command.sourceRoutingSheetId, tenantId);
    if (!source) throw new NotFoundError("RoutingSheet", command.sourceRoutingSheetId);
    if (source.stav !== "released") {
      throw new InvalidStateError(
        `Novou revizi lze vytvořit jen z vydaného ("released") postupu, ne ze stavu "${source.stav}".`
      );
    }

    const existingDraft = await this.routingSheetRepository.findDraftByPartId(tenantId, source.partId);
    if (existingDraft) {
      throw new RoutingSheetDraftAlreadyExistsError(source.partId, existingDraft.id);
    }

    const activeCount = (await this.routingSheetRepository.list(tenantId)).filter((rs) => rs.stav !== "archived").length;
    await this.featureAccessService.assertWithinLimit("routingSheets.active.max", activeCount + 1);

    const revision = await this.routingSheetRepository.getNextRevisionNumber(tenantId, source.partId);
    const newRevision = cloneRoutingSheetAsNewDraft(source, {
      newId: crypto.randomUUID(),
      tenantId,
      revision,
      createdAt: Date.now(),
      isDefault: true,
    });

    source.archive();
    source.clearDefault();
    await this.routingSheetRepository.save(source);
    await this.routingSheetRepository.save(newRevision);

    return newRevision;
  }
}
