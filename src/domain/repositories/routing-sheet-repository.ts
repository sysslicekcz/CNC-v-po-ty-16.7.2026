import { RoutingSheet } from "../aggregates/routing-sheet/routing-sheet";

/**
 * Write path pro celý strom RoutingSheet -> Operation -> Position -> Activity ->
 * Calculation. `save()` ukládá agregát atomicky. Žádná vnitřní entita nemá vlastní
 * write repository - viz zadání, bod 5 a 13.
 */
export interface RoutingSheetRepository {
  findById(id: string): Promise<RoutingSheet | null>;
  findByPartId(partId: string): Promise<RoutingSheet[]>;
  save(routingSheet: RoutingSheet): Promise<void>;
  delete(id: string): Promise<void>;
}
