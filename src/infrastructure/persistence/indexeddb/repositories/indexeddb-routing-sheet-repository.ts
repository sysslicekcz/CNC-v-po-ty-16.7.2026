import { RoutingSheetRepository } from "@/domain/repositories/routing-sheet-repository";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import {
  RoutingSheetRecord,
  OperationRecord,
  PositionRecord,
  ActivityRecord,
  CalculationRecord,
} from "../records";
import { LegacyStamp } from "../mappers/common";
import {
  RoutingSheetRecordSet,
  routingSheetToRecordSet,
  routingSheetFromRecordSet,
} from "../mappers/routing-sheet-mapper";
import { openTpvDb, wrapRequest, tpvGetAllByIndex, TpvStoreName } from "../tpv-db";

const TREE_STORES: TpvStoreName[] = [
  "tpvRoutingSheets",
  "tpvOperations",
  "tpvPositions",
  "tpvActivities",
  "tpvCalculations",
];

function getInTx<T>(tx: IDBTransaction, store: TpvStoreName, key: IDBValidKey): Promise<T | undefined> {
  return wrapRequest(tx.objectStore(store).get(key));
}
function getAllByIndexInTx<T>(tx: IDBTransaction, store: TpvStoreName, index: string, key: IDBValidKey): Promise<T[]> {
  return wrapRequest(tx.objectStore(store).index(index).getAll(key));
}
async function putInTx<T>(tx: IDBTransaction, store: TpvStoreName, value: T): Promise<void> {
  await wrapRequest(tx.objectStore(store).put(value));
}
async function deleteInTx(tx: IDBTransaction, store: TpvStoreName, key: IDBValidKey): Promise<void> {
  await wrapRequest(tx.objectStore(store).delete(key));
}

function commitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transakce byla přerušena."));
  });
}

/** Načte celý normalizovaný strom pro danou RoutingSheet uvnitř existující
 *  transakce (žádná vnořená transakce - zadání, bod 20). Vrací null, pokud root
 *  neexistuje. */
async function readRecordSetInTx(tx: IDBTransaction, routingSheetId: string): Promise<RoutingSheetRecordSet | null> {
  const routingSheetRecord = await getInTx<RoutingSheetRecord>(tx, "tpvRoutingSheets", routingSheetId);
  if (!routingSheetRecord) return null;

  const operations = await getAllByIndexInTx<OperationRecord>(tx, "tpvOperations", "routingSheetId", routingSheetId);

  const positions: PositionRecord[] = [];
  for (const operation of operations) {
    positions.push(...(await getAllByIndexInTx<PositionRecord>(tx, "tpvPositions", "operationId", operation.id)));
  }

  const activities: ActivityRecord[] = [];
  for (const position of positions) {
    activities.push(...(await getAllByIndexInTx<ActivityRecord>(tx, "tpvActivities", "positionId", position.id)));
  }

  const calculations: CalculationRecord[] = [];
  for (const activity of activities) {
    calculations.push(...(await getAllByIndexInTx<CalculationRecord>(tx, "tpvCalculations", "activityId", activity.id)));
  }

  return { routingSheet: routingSheetRecord, operations, positions, activities, calculations };
}

function legacyStampsFromRecordSet(recordSet: RoutingSheetRecordSet): Map<string, LegacyStamp> {
  const map = new Map<string, LegacyStamp>();
  const stampOf = (r: { legacySource?: string; legacyId?: string; migrationRunId?: string }): LegacyStamp => ({
    legacySource: r.legacySource,
    legacyId: r.legacyId,
    migrationRunId: r.migrationRunId,
  });
  map.set(recordSet.routingSheet.id, stampOf(recordSet.routingSheet));
  for (const r of recordSet.operations) map.set(r.id, stampOf(r));
  for (const r of recordSet.positions) map.set(r.id, stampOf(r));
  for (const r of recordSet.activities) map.set(r.id, stampOf(r));
  for (const r of recordSet.calculations) map.set(r.id, stampOf(r));
  return map;
}

/**
 * RoutingSheetRepository nad normalizovanou IndexedDB perzistencí (zadání, bod 7,
 * 19). `findById`/`save`/`delete` vždy pracují nad jednou transakcí přes všech
 * pět stores (Root+Operation+Position+Activity+Calculation), takže se strom
 * nikdy neuloží/nesmaže napůl. `save()` maže celý starý podstrom téhle konkrétní
 * RoutingSheet a zapisuje aktuální - jednodušší a stejně korektní jako přesný
 * diff, a nikdy se nedotkne záznamů patřících jiné RoutingSheet (dotazuje se
 * vždy jen podle FK odvozených z `routingSheetId`).
 */
export class IndexedDbRoutingSheetRepository implements RoutingSheetRepository {
  async findById(id: string): Promise<RoutingSheet | null> {
    const db = await openTpvDb();
    const tx = db.transaction(TREE_STORES, "readonly");
    const recordSet = await readRecordSetInTx(tx, id);
    return recordSet ? routingSheetFromRecordSet(recordSet) : null;
  }

  async findByPartId(partId: string): Promise<RoutingSheet[]> {
    const roots = await tpvGetAllByIndex<RoutingSheetRecord>("tpvRoutingSheets", "partId", partId);
    const results: RoutingSheet[] = [];
    for (const root of roots) {
      const routingSheet = await this.findById(root.id);
      if (routingSheet) results.push(routingSheet);
    }
    return results;
  }

  async save(routingSheet: RoutingSheet): Promise<void> {
    const db = await openTpvDb();
    const tx = db.transaction(TREE_STORES, "readwrite");
    const existing = await readRecordSetInTx(tx, routingSheet.id);
    const stamps = existing ? legacyStampsFromRecordSet(existing) : new Map<string, LegacyStamp>();
    await this.replaceTreeInTx(tx, existing, routingSheetToRecordSet(routingSheet, stamps));
    await commitTransaction(tx);
  }

  /** Jen pro infrastructure/migration - zapíše explicitní legacy stamp per
   *  záznam (viz mappers/routing-sheet-mapper.ts), ne součást domain rozhraní. */
  async saveWithLegacyStamps(routingSheet: RoutingSheet, stamps: Map<string, LegacyStamp>): Promise<void> {
    await this.saveRecordSet(routingSheetToRecordSet(routingSheet, stamps));
  }

  /**
   * Jen pro infrastructure/migration - uloží už sestavenou normalizovanou
   * sadu records přímo, beze změny (migrace do ActivityRecord dopisuje
   * `legacyInputParameters`, což je persistence-only pole, které mapper z
   * doménového agregátu vytvořit neumí - viz migrate-routing-data.ts). Stejná
   * atomická "smaž starý podstrom, zapiš nový" logika jako `save()`.
   */
  async saveRecordSet(recordSet: RoutingSheetRecordSet): Promise<void> {
    const db = await openTpvDb();
    const tx = db.transaction(TREE_STORES, "readwrite");
    const existing = await readRecordSetInTx(tx, recordSet.routingSheet.id);
    await this.replaceTreeInTx(tx, existing, recordSet);
    await commitTransaction(tx);
  }

  async delete(id: string): Promise<void> {
    const db = await openTpvDb();
    const tx = db.transaction(TREE_STORES, "readwrite");
    const existing = await readRecordSetInTx(tx, id);
    if (existing) {
      for (const r of existing.calculations) await deleteInTx(tx, "tpvCalculations", r.id);
      for (const r of existing.activities) await deleteInTx(tx, "tpvActivities", r.id);
      for (const r of existing.positions) await deleteInTx(tx, "tpvPositions", r.id);
      for (const r of existing.operations) await deleteInTx(tx, "tpvOperations", r.id);
    }
    await deleteInTx(tx, "tpvRoutingSheets", id);
    await commitTransaction(tx);
  }

  private async replaceTreeInTx(
    tx: IDBTransaction,
    existing: RoutingSheetRecordSet | null,
    next: RoutingSheetRecordSet
  ): Promise<void> {
    if (existing) {
      for (const r of existing.calculations) await deleteInTx(tx, "tpvCalculations", r.id);
      for (const r of existing.activities) await deleteInTx(tx, "tpvActivities", r.id);
      for (const r of existing.positions) await deleteInTx(tx, "tpvPositions", r.id);
      for (const r of existing.operations) await deleteInTx(tx, "tpvOperations", r.id);
    }
    await putInTx(tx, "tpvRoutingSheets", next.routingSheet);
    for (const r of next.operations) await putInTx(tx, "tpvOperations", r);
    for (const r of next.positions) await putInTx(tx, "tpvPositions", r);
    for (const r of next.activities) await putInTx(tx, "tpvActivities", r);
    for (const r of next.calculations) await putInTx(tx, "tpvCalculations", r);
  }
}
