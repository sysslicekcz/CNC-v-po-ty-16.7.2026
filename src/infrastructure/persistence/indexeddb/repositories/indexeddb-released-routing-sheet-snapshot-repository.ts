import { ReleasedRoutingSheetSnapshotRepository } from "@/domain/repositories/released-routing-sheet-snapshot-repository";
import { ReleasedRoutingSheetSnapshot } from "@/domain/aggregates/routing-sheet/released-snapshot";
import { ReleasedRoutingSheetSnapshotRecord } from "../records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "../tpv-db";

/** Immutable - `save()` je jediná zápisová operace (žádné update/delete, viz
 *  doménové rozhraní). Klíč store je `routingSheetId` (jedna revize = nejvýš
 *  jeden snapshot, protože revize se vydává jen jednou - druhé vydání téhož
 *  draftu není možné, `RoutingSheet.release()` to hlídá stavovým přechodem). */
export class IndexedDbReleasedRoutingSheetSnapshotRepository implements ReleasedRoutingSheetSnapshotRepository {
  async findByRoutingSheetId(routingSheetId: string, tenantId: string): Promise<ReleasedRoutingSheetSnapshot | null> {
    const record = await tpvGet<ReleasedRoutingSheetSnapshotRecord>("tpvReleasedRoutingSheetSnapshots", routingSheetId);
    if (!record || record.tenantId !== tenantId) return null;
    return record;
  }

  async listByPartId(tenantId: string, partId: string): Promise<ReleasedRoutingSheetSnapshot[]> {
    const records = await tpvGetAllByIndex<ReleasedRoutingSheetSnapshotRecord>(
      "tpvReleasedRoutingSheetSnapshots",
      "partId",
      partId
    );
    return records.filter((r) => r.tenantId === tenantId);
  }

  async save(snapshot: ReleasedRoutingSheetSnapshot): Promise<void> {
    await tpvPut("tpvReleasedRoutingSheetSnapshots", snapshot satisfies ReleasedRoutingSheetSnapshotRecord);
  }
}
