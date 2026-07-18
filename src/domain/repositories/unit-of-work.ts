/** Transakční hranice pro use casy, které zapisují do víc než jednoho agregátu
 *  najednou. Infrastruktura (IndexedDB) ji mapuje na jednu IDBTransaction napříč
 *  object store. */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
