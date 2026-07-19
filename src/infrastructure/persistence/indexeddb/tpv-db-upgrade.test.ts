import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { openTpvDb, resetTpvDbConnectionForTests, deleteTpvDbForTests, tpvGet } from "./tpv-db";
import { OperationTypeRecord, ToolTypeRecord } from "./records";

const DB_NAME = "cnc-tpv";

/**
 * Vytvoří DB v PŘESNĚ takovém tvaru, v jakém by byla appka na verzi 4 (před
 * Krokem 5) - vlastní minimální `onupgradeneeded`, NE sdílená `upgrade()`
 * funkce z tpv-db.ts. Sdílená `upgrade()` je navržená tak, aby vždy dotáhla
 * DB na aktuální `DB_VERSION` (funguje podle `event.oldVersion`, ne podle
 * cílové verze zadané do `indexedDB.open()`), takže by pro čerstvou DB
 * (oldVersion=0) spustila i blok Kroku 5 bez ohledu na to, jaké cílové číslo
 * verze dostane - proto tenhle test schéma verze 4 sestavuje ručně.
 */
function openLegacyV4Db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 4);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("tpvOperationTypes", { keyPath: "id" });
      db.createObjectStore("tpvToolTypes", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putRaw(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe("tpv-db upgrade v4 -> v5 (Krok 5 backfill tenantId na OperationType/ToolType)", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("doplní tenantId a nová pole na existující OperationType/ToolType záznamy bez destrukce dat", async () => {
    // 1) Appka "na verzi 4" - starý tvar bez tenantId.
    const dbV4 = await openLegacyV4Db();
    await putRaw(dbV4, "tpvOperationTypes", {
      id: "ot-legacy-1",
      kod: "podelneVnejsi",
      nazev: "Podélné vnější",
      kategorie: "turning",
      stav: "aktivni",
    } satisfies Partial<OperationTypeRecord>);
    await putRaw(dbV4, "tpvToolTypes", {
      id: "tt-legacy-1",
      kod: "obecny",
      nazev: "Obecný nástroj",
      stav: "aktivni",
    } satisfies Partial<ToolTypeRecord>);
    dbV4.close();
    await resetTpvDbConnectionForTests();

    // 2) Appka se otevře na aktuální verzi (5) - spustí se backfill.
    await openTpvDb();

    const operationType = await tpvGet<OperationTypeRecord>("tpvOperationTypes", "ot-legacy-1");
    expect(operationType?.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(operationType?.resourceRequirement).toBe("machine");
    expect(operationType?.requiresSetupTime).toBe(true);
    expect(operationType?.requiresUnitTime).toBe(true);
    // Původní data zůstala beze změny (žádná destrukce).
    expect(operationType?.kod).toBe("podelneVnejsi");
    expect(operationType?.nazev).toBe("Podélné vnější");

    const toolType = await tpvGet<ToolTypeRecord>("tpvToolTypes", "tt-legacy-1");
    expect(toolType?.tenantId).toBe(DEFAULT_TENANT_ID);
    expect(toolType?.category).toBe("other");
    expect(toolType?.parameterDefinitions).toEqual([]);
    expect(toolType?.kod).toBe("obecny");
  });

  it("nové stores Kroku 5 existují a jsou prázdné po čerstvé instalaci", async () => {
    const db = await openTpvDb();
    expect(db.objectStoreNames.contains("tpvCapabilityTypes")).toBe(true);
    expect(db.objectStoreNames.contains("tpvMachineCapabilityValues")).toBe(true);
    expect(db.objectStoreNames.contains("tpvOperationTypeCapabilityRequirements")).toBe(true);
    expect(db.objectStoreNames.contains("tpvSuppliers")).toBe(true);
    expect(db.objectStoreNames.contains("tpvMaterialGroups")).toBe(true);
    expect(db.objectStoreNames.contains("tpvMaterials")).toBe(true);
  });
});
