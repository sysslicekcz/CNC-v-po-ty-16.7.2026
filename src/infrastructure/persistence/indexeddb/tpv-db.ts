// Tenký promisifikovaný wrapper nad IndexedDB pro NOVOU TPV doménu - stejný vzor
// jako src/lib/db.ts, ale zcela SAMOSTATNÁ databáze ("cnc-tpv", ne "cnc-casovac").
// Záměrně žádná sdílená databáze/verze se starou appkou (viz docs/adr/0011) -
// stará appka a src/lib/db.ts zůstávají zcela nedotčené, žádné riziko kolize
// při upgrade schématu.

const DB_NAME = "cnc-tpv";
const DB_VERSION = 1;

export type TpvStoreName =
  | "tpvCustomers"
  | "tpvOrders"
  | "tpvParts"
  | "tpvRoutingSheets"
  | "tpvOperations"
  | "tpvPositions"
  | "tpvActivities"
  | "tpvCalculations"
  | "tpvMachines"
  | "tpvMachineCapabilities"
  | "tpvOperationTypes"
  | "tpvTools"
  | "tpvToolTypes"
  | "tpvToolMachineConditions"
  | "tpvMigrationRuns"
  | "tpvMigrationIssues"
  | "tpvMigrationBackups"
  | "tpvSettings";

let dbPromise: Promise<IDBDatabase> | null = null;

function createStores(db: IDBDatabase): void {
  const customers = db.createObjectStore("tpvCustomers", { keyPath: "id" });
  customers.createIndex("legacyId", "legacyId");

  const orders = db.createObjectStore("tpvOrders", { keyPath: "id" });
  orders.createIndex("customerId", "customerId");
  orders.createIndex("legacyId", "legacyId");

  const parts = db.createObjectStore("tpvParts", { keyPath: "id" });
  parts.createIndex("orderId", "orderId");
  parts.createIndex("legacyId", "legacyId");

  const routingSheets = db.createObjectStore("tpvRoutingSheets", { keyPath: "id" });
  routingSheets.createIndex("partId", "partId");
  routingSheets.createIndex("legacyId", "legacyId");

  const operations = db.createObjectStore("tpvOperations", { keyPath: "id" });
  operations.createIndex("routingSheetId", "routingSheetId");
  operations.createIndex("sortKey", "sortKey");
  operations.createIndex("legacyId", "legacyId");
  operations.createIndex("machineId", "machineId");

  const positions = db.createObjectStore("tpvPositions", { keyPath: "id" });
  positions.createIndex("operationId", "operationId");
  positions.createIndex("sortKey", "sortKey");
  positions.createIndex("legacyId", "legacyId");

  const activities = db.createObjectStore("tpvActivities", { keyPath: "id" });
  activities.createIndex("positionId", "positionId");
  activities.createIndex("sortKey", "sortKey");
  activities.createIndex("calculationType", "calculationType");
  activities.createIndex("operationTypeId", "operationTypeId");
  activities.createIndex("legacyId", "legacyId");

  const calculations = db.createObjectStore("tpvCalculations", { keyPath: "id" });
  calculations.createIndex("activityId", "activityId");

  const machines = db.createObjectStore("tpvMachines", { keyPath: "id" });
  machines.createIndex("legacyId", "legacyId");

  const machineCapabilities = db.createObjectStore("tpvMachineCapabilities", { keyPath: "id" });
  machineCapabilities.createIndex("machineId", "machineId");
  machineCapabilities.createIndex("operationTypeId", "operationTypeId");

  db.createObjectStore("tpvOperationTypes", { keyPath: "id" });

  const tools = db.createObjectStore("tpvTools", { keyPath: "id" });
  tools.createIndex("legacyId", "legacyId");
  tools.createIndex("toolTypeId", "toolTypeId");

  db.createObjectStore("tpvToolTypes", { keyPath: "id" });

  const toolMachineConditions = db.createObjectStore("tpvToolMachineConditions", { keyPath: "id" });
  toolMachineConditions.createIndex("toolId", "toolId");
  toolMachineConditions.createIndex("machineId", "machineId");
  toolMachineConditions.createIndex("operationTypeId", "operationTypeId");
  toolMachineConditions.createIndex("materialId", "materialId");
  toolMachineConditions.createIndex("machiningMode", "machiningMode");

  db.createObjectStore("tpvMigrationRuns", { keyPath: "id" });

  const migrationIssues = db.createObjectStore("tpvMigrationIssues", { keyPath: "id" });
  migrationIssues.createIndex("migrationRunId", "migrationRunId");

  db.createObjectStore("tpvMigrationBackups", { keyPath: "id" });

  // Jednoduché feature-flag úložiště (zadání, bod 26) - "migrationCompleted",
  // "newTpvModelEnabled". Záměrně jen key/value, žádný feature management systém.
  db.createObjectStore("tpvSettings", { keyPath: "key" });
}

export function openTpvDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB není v tomto prostředí k dispozici."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => createStores(req.result);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export function wrapRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function tpvGetAll<T>(store: TpvStoreName): Promise<T[]> {
  const db = await openTpvDb();
  return wrapRequest(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function tpvGetAllByIndex<T>(store: TpvStoreName, indexName: string, key: IDBValidKey): Promise<T[]> {
  const db = await openTpvDb();
  return wrapRequest(db.transaction(store, "readonly").objectStore(store).index(indexName).getAll(key));
}

export async function tpvGet<T>(store: TpvStoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openTpvDb();
  return wrapRequest(db.transaction(store, "readonly").objectStore(store).get(key));
}

export async function tpvPut<T>(store: TpvStoreName, value: T): Promise<void> {
  const db = await openTpvDb();
  await wrapRequest(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function tpvDelete(store: TpvStoreName, key: IDBValidKey): Promise<void> {
  const db = await openTpvDb();
  await wrapRequest(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

export async function tpvClearStore(store: TpvStoreName): Promise<void> {
  const db = await openTpvDb();
  await wrapRequest(db.transaction(store, "readwrite").objectStore(store).clear());
}

/** Jen pro testy - zavře aktuální připojení (jinak `deleteDatabase` visí na
 *  "blocked", protože fake-indexeddb i skutečné IndexedDB čekají, až se všechny
 *  otevřené handle zavřou) a zapomene ho, aby si další test otevřel čerstvou
 *  databázi. */
export async function resetTpvDbConnectionForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

/** Smaže celou TPV databázi (jen testy / explicitní reset nástroje, nikdy appka
 *  sama automaticky). Nemá vliv na starou databázi "cnc-casovac". */
export async function deleteTpvDbForTests(): Promise<void> {
  await resetTpvDbConnectionForTests();
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
