import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { PartRepository } from "@/domain/repositories/part-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { RoutingSheetListItemDto } from "./dto/routing-sheet-list-item-dto";

/** Základní seznam (Krok 4, zadání bod 34) - vrací VŠECHNY postupy tenanta,
 *  filtrování (hledání/stav/díl/jen aktuální revize) dělá UI nad touhle
 *  sadou - žádný reporting dashboard, jen jednoduchý přehled. */
export class ListRoutingSheetsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly routingSheetRepository: RoutingSheetRepository,
    private readonly partRepository: PartRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<RoutingSheetListItemDto[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingView, "read");

    const routingSheets = await this.routingSheetRepository.list(tenantId);
    const partIds = [...new Set(routingSheets.map((rs) => rs.partId))];
    const parts = await Promise.all(partIds.map((id) => this.partRepository.findById(id)));
    const partsById = new Map(parts.filter((p) => p !== null).map((p) => [p.id, p]));

    return routingSheets
      .map((rs): RoutingSheetListItemDto => {
        const part = partsById.get(rs.partId);
        return {
          id: rs.id,
          partId: rs.partId,
          drawingNumber: part?.cisloVykresu ?? "",
          partName: part?.nazev ?? "",
          revision: rs.revisionNumber,
          status: rs.stav,
          operationCount: rs.operationList.length,
          isDefault: rs.isDefault,
          updatedAt: rs.updatedAt ? new Date(rs.updatedAt).toISOString() : undefined,
          releasedAt: rs.releasedAt ? new Date(rs.releasedAt).toISOString() : undefined,
        };
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }
}
