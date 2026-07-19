export interface Entity {
  id: string;
}

/** Obecné CRUD rozhraní pro jednoduché agregáty (Customer, Order, Part, Machine,
 *  Tool, číselníky, ...). RoutingSheet má vlastní rozhraní (routing-sheet-
 *  repository.ts) - je to Aggregate Root, jehož vnitřní entity (Operation,
 *  Position, Activity, Calculation) nemají vlastní write repository (zadání,
 *  bod 13). */
export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
