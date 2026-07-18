import { RoutingSheet } from "../aggregates/routing-sheet/routing-sheet";

/**
 * Write path pro celý strom RoutingSheet -> Operation -> Position -> Activity ->
 * Calculation. `save()` ukládá agregát atomicky. Žádná vnitřní entita nemá vlastní
 * write repository - viz zadání, bod 5 a 13.
 *
 * Tenant-scoped stejně jako `MachineRepository` (Krok 4, zadání bod 32/42) -
 * `findById`/`delete` vždy ověří shodu `tenantId`, ne že spoléhají na to, že
 * interní UUID nikdy nikdo neuhodne.
 */
export interface RoutingSheetRepository {
  findById(id: string, tenantId: string): Promise<RoutingSheet | null>;
  listByPartId(tenantId: string, partId: string): Promise<RoutingSheet[]>;
  /** Aktuální draft daného dílu, pokud existuje (nejvýš jeden draft na díl -
   *  viz docs/adr/new-revision-instead-of-editing-release.md). */
  findDraftByPartId(tenantId: string, partId: string): Promise<RoutingSheet | null>;
  /** Další volné číslo revize pro daný díl (`max(revisionNumber) + 1`, nebo `1`,
   *  pokud díl ještě žádný postup nemá). */
  getNextRevisionNumber(tenantId: string, partId: string): Promise<number>;
  list(tenantId: string): Promise<RoutingSheet[]>;
  save(routingSheet: RoutingSheet): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
