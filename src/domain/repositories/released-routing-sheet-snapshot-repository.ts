import { ReleasedRoutingSheetSnapshot } from "../aggregates/routing-sheet/released-snapshot";

/** Immutable projekce (Krok 4, zadání bod 52) - jen zápis při vydání a čtení,
 *  žádné `update`/`delete` v tomhle rozhraní (přepsání/smazání vydaného snapshotu
 *  by porušilo "Změna kmenových dat nesmí změnit historický vydaný postup"). */
export interface ReleasedRoutingSheetSnapshotRepository {
  findByRoutingSheetId(routingSheetId: string, tenantId: string): Promise<ReleasedRoutingSheetSnapshot | null>;
  listByPartId(tenantId: string, partId: string): Promise<ReleasedRoutingSheetSnapshot[]>;
  save(snapshot: ReleasedRoutingSheetSnapshot): Promise<void>;
}
