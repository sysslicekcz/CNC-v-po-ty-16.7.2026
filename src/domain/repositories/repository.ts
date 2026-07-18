export interface Entity {
  id: string;
}

/** Obecné CRUD rozhraní pro agregáty bez vlastní bohatší potřeby (Customer, Order,
 *  Part, Tool, ...). RoutingSheet má vlastní rozhraní (viz routing-sheet-repository.ts) -
 *  je to Aggregate Root s bohatším chováním okolo ukládání celého stromu. */
export interface Repository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
