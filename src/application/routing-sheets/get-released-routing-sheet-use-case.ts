import { ReleasedRoutingSheetSnapshotRepository } from "@/domain/repositories/released-routing-sheet-snapshot-repository";
import { ReleasedRoutingSheetSnapshot } from "@/domain/aggregates/routing-sheet/released-snapshot";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

/** Read-only zobrazení vydané revize (Krok 4, zadání bod 29/51/52) - čte
 *  výhradně immutable snapshot, ne živý agregát, takže pozdější přejmenování
 *  stroje/nástroje/typu operace vydaný dokument nezmění. */
export class GetReleasedRoutingSheetUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly releasedSnapshotRepository: ReleasedRoutingSheetSnapshotRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(routingSheetId: string): Promise<ReleasedRoutingSheetSnapshot> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.RoutingView, "read");

    const snapshot = await this.releasedSnapshotRepository.findByRoutingSheetId(routingSheetId, tenantId);
    if (!snapshot) throw new NotFoundError("ReleasedRoutingSheetSnapshot", routingSheetId);
    return snapshot;
  }
}
