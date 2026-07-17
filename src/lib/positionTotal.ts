import { getAllByIndex } from "./db";
import { computeOperation, Row } from "./results";

interface PartOperationRowsRecord {
  id: string;
  partId: string;
  opId: string;
  rows: Row[];
}

/** Součet výrobního času přes všechny operace jedné polohy. Obyčejná async funkce
 *  (ne hook) - volá se pro proměnný počet poloh najednou (v PartRouteru), a hook
 *  nejde zavolat v cyklu přes dynamický seznam. */
export async function computePositionTotal(positionId: string): Promise<number> {
  const records = await getAllByIndex<PartOperationRowsRecord>("partOperationRows", "partId", positionId);
  let total = 0;
  for (const r of records) {
    total += computeOperation(r.opId, r.rows).total;
  }
  return total;
}
