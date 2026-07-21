// Tenký promisifikovaný wrapper nad IndexedDB pro NOVOU TPV doménu - stejný vzor
// jako src/lib/db.ts, ale zcela SAMOSTATNÁ databáze ("cnc-tpv", ne "cnc-casovac").
// Záměrně žádná sdílená databáze/verze se starou appkou (viz docs/adr/0011) -
// stará appka a src/lib/db.ts zůstávají zcela nedotčené, žádné riziko kolize
// při upgrade schématu.

import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";

const DB_NAME = "cnc-tpv";
const DB_VERSION = 8;
/** Použito jen k backfillu Kroku 5 (viz `upgrade()`, `oldVersion < 5`) - appka
 *  dosud běží s jediným výchozím tenantem, takže existující OperationType/
 *  ToolType záznamy patří logicky jemu. */
const BACKFILL_TENANT_ID = DEFAULT_TENANT_ID;

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
  | "tpvSettings"
  | "tpvTenants"
  | "tpvCapacityGroups"
  | "tpvExternalOperationResources"
  | "tpvLicenses"
  | "tpvLicenseValidation"
  | "tpvExternalSystems"
  | "tpvExternalReferences"
  | "tpvIntegrationRuns"
  | "tpvIntegrationIssues"
  | "tpvReleasedRoutingSheetSnapshots"
  | "tpvCapabilityTypes"
  | "tpvMachineCapabilityValues"
  | "tpvOperationTypeCapabilityRequirements"
  | "tpvSuppliers"
  | "tpvMaterialGroups"
  | "tpvMaterials"
  | "tpvCalculationRequests"
  | "tpvCalculationResults"
  | "tpvRuleVersions"
  | "tpvMaterialProfiles"
  | "tpvMaterialCorrections"
  | "tpvMachineProfiles"
  | "tpvMachineCorrections"
  | "tpvToolProfiles"
  | "tpvToolCorrections"
  | "tpvCuttingConditions"
  | "tpvManualTimeStandards"
  | "tpvInspectionEquipmentProfiles";

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Aditivní upgrade po `event.oldVersion` (stejný bezpečný vzor jako
 * src/lib/db.ts) - žádný store/index se nikdy neničí ani nepřepisuje, jen
 * přibývá. Krok 3.5 (verze 2) přidává tenant/licenční stores a rozšiřuje
 * `tpvMachines` o unikátní `[tenantId+code]` index (docs/adr/0015). Krok 3.5
 * dodatek "ERP-nezávislá architektura" (verze 3) přidává ERP-neutrální
 * integrační stores (docs/adr/erp-agnostic-integration-layer.md) - žádný z
 * nich nezná jméno konkrétního ERP.
 */
/** Exportováno JEN kvůli testovatelnosti upgrade cesty (viz tpv-db-upgrade.test.ts) -
 *  appka sama volá výhradně přes `openTpvDb()`. */
export function upgrade(db: IDBDatabase, oldVersion: number, upgradeTx: IDBTransaction): void {
  if (oldVersion < 1) {
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

    // Jednoduché feature-flag úložiště (zadání Krok 3, bod 26) - "migrationCompleted",
    // "newTpvModelEnabled". Záměrně jen key/value, žádný feature management systém.
    db.createObjectStore("tpvSettings", { keyPath: "key" });
  }

  if (oldVersion < 2) {
    // Krok 3.5 - tenant + podnikové kódy + licence (viz docs/adr/0015, 0019, 0020).
    // Nové indexy na JIŽ existujících stores lze za běhu onupgradeneeded přidat
    // jen přes store získaný z probíhající versionchange transakce, ne přes
    // db.createObjectStore (ta je jen pro nové stores).
    const machinesStore = upgradeTx.objectStore("tpvMachines");
    if (!machinesStore.indexNames.contains("tenantId")) machinesStore.createIndex("tenantId", "tenantId");
    if (!machinesStore.indexNames.contains("tenantId_code")) {
      machinesStore.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });
    }
    if (!machinesStore.indexNames.contains("capacityGroupId")) {
      machinesStore.createIndex("capacityGroupId", "capacityGroupId");
    }

    const capabilitiesStore = upgradeTx.objectStore("tpvMachineCapabilities");
    if (!capabilitiesStore.indexNames.contains("tenantId")) capabilitiesStore.createIndex("tenantId", "tenantId");

    const toolsStore = upgradeTx.objectStore("tpvTools");
    if (!toolsStore.indexNames.contains("tenantId")) toolsStore.createIndex("tenantId", "tenantId");
    if (!toolsStore.indexNames.contains("tenantId_code")) {
      toolsStore.createIndex("tenantId_code", ["tenantId", "code"]); // code je nepovinný -> ne unique
    }

    const conditionsStore = upgradeTx.objectStore("tpvToolMachineConditions");
    if (!conditionsStore.indexNames.contains("tenantId")) conditionsStore.createIndex("tenantId", "tenantId");

    const migrationRunsStore = upgradeTx.objectStore("tpvMigrationRuns");
    if (!migrationRunsStore.indexNames.contains("tenantId")) migrationRunsStore.createIndex("tenantId", "tenantId");

    const migrationIssuesStore = upgradeTx.objectStore("tpvMigrationIssues");
    if (!migrationIssuesStore.indexNames.contains("tenantId")) migrationIssuesStore.createIndex("tenantId", "tenantId");

    const tenants = db.createObjectStore("tpvTenants", { keyPath: "id" });
    tenants.createIndex("code", "code", { unique: true });
    tenants.createIndex("status", "status");

    const capacityGroups = db.createObjectStore("tpvCapacityGroups", { keyPath: "id" });
    capacityGroups.createIndex("tenantId", "tenantId");
    capacityGroups.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });

    const externalResources = db.createObjectStore("tpvExternalOperationResources", { keyPath: "id" });
    externalResources.createIndex("tenantId", "tenantId");
    externalResources.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });

    const licenses = db.createObjectStore("tpvLicenses", { keyPath: "id" });
    licenses.createIndex("tenantId", "tenantId", { unique: true });
    licenses.createIndex("status", "status");
    licenses.createIndex("planCode", "planCode");
    licenses.createIndex("validUntil", "validUntil");

    const licenseValidation = db.createObjectStore("tpvLicenseValidation", { keyPath: "tenantId" });
    licenseValidation.createIndex("status", "status");
    licenseValidation.createIndex("lastValidatedAt", "lastValidatedAt");
    licenseValidation.createIndex("gracePeriodUntil", "gracePeriodUntil");
  }

  if (oldVersion < 3) {
    // Krok 3.5 dodatek - "ERP-nezávislá architektura". Appka nezná napevno
    // žádný konkrétní ERP - `tpvExternalSystems`/`tpvExternalReferences` jsou
    // stejné bez ohledu na to, jestli se appka připojí na Helios, SAP, K2,
    // vlastní REST API nebo Excel/CSV výměnu (viz docs/adr/erp-agnostic-integration-layer.md).
    const externalSystems = db.createObjectStore("tpvExternalSystems", { keyPath: "id" });
    externalSystems.createIndex("tenantId", "tenantId");
    externalSystems.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });

    const externalReferences = db.createObjectStore("tpvExternalReferences", { keyPath: "id" });
    externalReferences.createIndex("tenantId", "tenantId");
    externalReferences.createIndex("externalSystemId", "externalSystemId");
    // `externalId` je nepovinný - záznamy bez něj se do tohohle indexu vůbec
    // nezapíší (IndexedDB compound index vynechá záznam, pokud kterákoliv
    // složka klíče chybí), takže "unique" tady hlídá jen unikátnost MEZI
    // záznamy, které `externalId` mají - přesně požadovaná sémantika
    // "stejné externalId smí nezávisle existovat ve dvou různých systémech".
    externalReferences.createIndex(
      "externalSystemId_externalEntityType_externalId",
      ["externalSystemId", "externalEntityType", "externalId"],
      { unique: true }
    );

    const integrationRuns = db.createObjectStore("tpvIntegrationRuns", { keyPath: "id" });
    integrationRuns.createIndex("tenantId", "tenantId");
    integrationRuns.createIndex("externalSystemId", "externalSystemId");

    const integrationIssues = db.createObjectStore("tpvIntegrationIssues", { keyPath: "id" });
    integrationIssues.createIndex("tenantId", "tenantId");
    integrationIssues.createIndex("integrationRunId", "integrationRunId");
  }

  if (oldVersion < 4) {
    // Krok 4 - editor technologického postupu. `tpvRoutingSheets` dostává
    // `tenantId` (viz docs/audits/step-4-audit.md - RoutingSheet byl dosud bez
    // tenant scope) a nový store pro immutable release projekci (zadání bod 52) -
    // `tpvOperations`/`tpvPositions`/`tpvActivities`/`tpvCalculations` zůstávají
    // BEZ vlastního tenantId indexu, izolace se hlídá na RoutingSheet rootu.
    const routingSheetsStore = upgradeTx.objectStore("tpvRoutingSheets");
    if (!routingSheetsStore.indexNames.contains("tenantId")) {
      routingSheetsStore.createIndex("tenantId", "tenantId");
    }
    if (!routingSheetsStore.indexNames.contains("tenantId_partId")) {
      routingSheetsStore.createIndex("tenantId_partId", ["tenantId", "partId"]);
    }

    const releasedSnapshots = db.createObjectStore("tpvReleasedRoutingSheetSnapshots", { keyPath: "routingSheetId" });
    releasedSnapshots.createIndex("tenantId", "tenantId");
    releasedSnapshots.createIndex("partId", "partId");
  }

  if (oldVersion < 5) {
    // Krok 5 - správa kmenových dat. `tpvOperationTypes`/`tpvToolTypes` byly
    // dosud globální (seedovaný číselník bez tenantId, viz docs/audits/step-5-audit.md,
    // riziko migrace č. 1) - Krok 5 z nich dělá editovatelná kmenová data, takže
    // MUSÍ dostat tenant scope. Na rozdíl od ostatních aditivních upgradů výš
    // tenhle blok existující záznamy i BACKFILLUJE (přečte je a přepíše s
    // doplněným tenantId), ne jen přidá prázdný index - bezpečné, protože jde o
    // malý, dopředu známý deterministicky seedovaný číselník, ne libovolně
    // velká uživatelská data.
    const operationTypesStore = upgradeTx.objectStore("tpvOperationTypes");
    if (!operationTypesStore.indexNames.contains("tenantId")) {
      operationTypesStore.createIndex("tenantId", "tenantId");
    }
    if (!operationTypesStore.indexNames.contains("tenantId_kod")) {
      operationTypesStore.createIndex("tenantId_kod", ["tenantId", "kod"], { unique: true });
    }
    operationTypesStore.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      const record = cursor.value as Record<string, unknown>;
      if (record.tenantId === undefined) {
        cursor.update({
          ...record,
          tenantId: BACKFILL_TENANT_ID,
          resourceRequirement: record.resourceRequirement ?? "machine",
          requiresSetupTime: record.requiresSetupTime ?? true,
          requiresUnitTime: record.requiresUnitTime ?? true,
        });
      }
      cursor.continue();
    };

    const toolTypesStore = upgradeTx.objectStore("tpvToolTypes");
    if (!toolTypesStore.indexNames.contains("tenantId")) {
      toolTypesStore.createIndex("tenantId", "tenantId");
    }
    if (!toolTypesStore.indexNames.contains("tenantId_kod")) {
      toolTypesStore.createIndex("tenantId_kod", ["tenantId", "kod"], { unique: true });
    }
    toolTypesStore.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor) return;
      const record = cursor.value as Record<string, unknown>;
      if (record.tenantId === undefined) {
        cursor.update({
          ...record,
          tenantId: BACKFILL_TENANT_ID,
          category: record.category ?? "other",
          parameterDefinitions: record.parameterDefinitions ?? [],
        });
      }
      cursor.continue();
    };

    const capabilityTypes = db.createObjectStore("tpvCapabilityTypes", { keyPath: "id" });
    capabilityTypes.createIndex("tenantId", "tenantId");
    capabilityTypes.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });

    const machineCapabilityValues = db.createObjectStore("tpvMachineCapabilityValues", { keyPath: "id" });
    machineCapabilityValues.createIndex("tenantId", "tenantId");
    machineCapabilityValues.createIndex("machineId", "machineId");
    machineCapabilityValues.createIndex("capabilityTypeId", "capabilityTypeId");
    machineCapabilityValues.createIndex("machineId_capabilityTypeId", ["machineId", "capabilityTypeId"], { unique: true });

    const operationTypeCapabilityRequirements = db.createObjectStore("tpvOperationTypeCapabilityRequirements", {
      keyPath: "id",
    });
    operationTypeCapabilityRequirements.createIndex("tenantId", "tenantId");
    operationTypeCapabilityRequirements.createIndex("operationTypeId", "operationTypeId");

    const suppliers = db.createObjectStore("tpvSuppliers", { keyPath: "id" });
    suppliers.createIndex("tenantId", "tenantId");
    suppliers.createIndex("tenantId_code", ["tenantId", "code"]); // code je nepovinný -> ne unique

    const materialGroups = db.createObjectStore("tpvMaterialGroups", { keyPath: "id" });
    materialGroups.createIndex("tenantId", "tenantId");
    materialGroups.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });

    const materials = db.createObjectStore("tpvMaterials", { keyPath: "id" });
    materials.createIndex("tenantId", "tenantId");
    materials.createIndex("tenantId_code", ["tenantId", "code"], { unique: true });
    materials.createIndex("materialGroupId", "materialGroupId");
  }

  if (oldVersion < 6) {
    // Manufacturing Calculation Engine (AP-MCE-001, Fáze A) - první samostatný
    // modul platformy (viz docs, AP-CPP-006). Tři nové stores, žádná úprava
    // existujících - `tpvCalculations` (Krok 4, jeden výpočet na Activity)
    // zůstává beze změny, tenhle modul je vedle něj, ne náhrada (most mezi
    // nimi staví až pozdější fáze, viz `domain/calculation-engine/services/
    // calculation-engine.ts`).
    const calculationRequests = db.createObjectStore("tpvCalculationRequests", { keyPath: "id" });
    calculationRequests.createIndex("tenantId", "tenantId");
    calculationRequests.createIndex("tenantId_idempotencyKey", ["tenantId", "idempotencyKey"], { unique: true });

    const calculationResults = db.createObjectStore("tpvCalculationResults", { keyPath: "id" });
    calculationResults.createIndex("tenantId", "tenantId");
    calculationResults.createIndex("calculationRequestId", "calculationRequestId");

    const ruleVersions = db.createObjectStore("tpvRuleVersions", { keyPath: "id" });
    ruleVersions.createIndex("tenantId", "tenantId");
    ruleVersions.createIndex("tenantId_status", ["tenantId", "status"]);
  }

  if (oldVersion < 7) {
    // Manufacturing Calculation Engine (AP-MCE-001, Fáze B) - Material/Machine/
    // ToolProfile + jejich tenant Correction (overlay model, viz `*-profile-overlay.ts`)
    // a CuttingCondition read-model. Sedm nových stores, žádná úprava
    // existujících - stejný aditivní vzor jako `oldVersion < 6` výš. Sekundární
    // dotazy (`findByExternalReference`, `findCandidates`, `findSystemDefault`)
    // filtrují v JS nad `tenantId` indexem, stejný vzor jako zbytek appky (viz
    // `IndexedDbCalculationRepository.findRequestByIdempotencyKey`) - žádný z
    // nových stores tak nepotřebuje složené indexy nad polem `externalReferences`
    // (IndexedDB neumí indexovat pole objektů).
    const materialProfiles = db.createObjectStore("tpvMaterialProfiles", { keyPath: "id" });
    materialProfiles.createIndex("tenantId", "tenantId");

    const materialCorrections = db.createObjectStore("tpvMaterialCorrections", { keyPath: "id" });
    materialCorrections.createIndex("tenantId", "tenantId");
    materialCorrections.createIndex("materialProfileId", "materialProfileId");

    const machineProfiles = db.createObjectStore("tpvMachineProfiles", { keyPath: "id" });
    machineProfiles.createIndex("tenantId", "tenantId");
    machineProfiles.createIndex("physicalMachineId", "physicalMachineId");

    const machineCorrections = db.createObjectStore("tpvMachineCorrections", { keyPath: "id" });
    machineCorrections.createIndex("tenantId", "tenantId");
    machineCorrections.createIndex("machineProfileId", "machineProfileId");

    const toolProfiles = db.createObjectStore("tpvToolProfiles", { keyPath: "id" });
    toolProfiles.createIndex("tenantId", "tenantId");

    const toolCorrections = db.createObjectStore("tpvToolCorrections", { keyPath: "id" });
    toolCorrections.createIndex("tenantId", "tenantId");
    toolCorrections.createIndex("toolProfileId", "toolProfileId");

    const cuttingConditions = db.createObjectStore("tpvCuttingConditions", { keyPath: "id" });
    cuttingConditions.createIndex("tenantId", "tenantId");
    cuttingConditions.createIndex("materialProfileId", "materialProfileId");
  }

  if (oldVersion < 8) {
    // Manufacturing Calculation Engine (AP-MCE-001, Fáze F) - ManualTimeStandard
    // (ruční operace) a InspectionEquipmentProfile (kontrola). Dva nové stores,
    // žádná úprava existujících - stejný aditivní vzor jako `oldVersion < 7`
    // výš. `tpvManualTimeStandards.tenantId` nese speciální hodnotu "system"
    // pro globální (systémové) standardy (doména je nese jako `tenantId ===
    // undefined` - IndexedDB index potřebuje konkrétní hodnotu klíče, viz
    // `IndexedDbManualTimeStandardRepository`).
    const manualTimeStandards = db.createObjectStore("tpvManualTimeStandards", { keyPath: "id" });
    manualTimeStandards.createIndex("tenantId", "tenantId");
    manualTimeStandards.createIndex("operationSubtype", "operationSubtype");

    const inspectionEquipmentProfiles = db.createObjectStore("tpvInspectionEquipmentProfiles", { keyPath: "id" });
    inspectionEquipmentProfiles.createIndex("tenantId", "tenantId");
  }
}

export function openTpvDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB není v tomto prostředí k dispozici."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const upgradeTx = req.transaction;
        if (!upgradeTx) throw new Error("IndexedDB upgrade transakce není dostupná.");
        upgrade(req.result, event.oldVersion, upgradeTx);
      };
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
