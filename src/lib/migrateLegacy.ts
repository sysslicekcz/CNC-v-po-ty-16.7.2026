"use client";

import { get, getAll, put, clearStore } from "./db";
import { MACHINE_OPERATIONS, OPERATIONS, TOOL_OPERATIONS } from "./operations";
import { convertLegacyToolRows } from "./toolCatalog";
import { Row } from "./results";

const LEGACY_PREFIX = "cnc-casovac:";
const MIGRATION_FLAG_KEY = "legacyMigrated";
const MACHINE_CATALOG_MIGRATION_FLAG_KEY = "machineCatalogMigrated";

interface ToolRowsRecord {
  strojId: string;
  opId: string;
  rows: Row[];
}

function readLegacyRows(key: string): Row[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Jednorázově přesune stará data z localStorage (ploché operace + nástroje, z doby
 *  před zavedením strojů) do IndexedDB. Kontury skončí v novém dílu "Nezařazeno /
 *  Migrovaná data / Díl 1", ať se nic neztratí. Katalog nástrojů z tehdejší doby
 *  nebyl vázaný na žádný stroj, ale nový katalog (lib/toolCatalog.ts) na strojI je -
 *  proto se pro něj založí i placeholder stroj "Migrovaný katalog (bez stroje)",
 *  který jde v záložce Stroje přejmenovat nebo smazat. Fail-soft - chyba migrace
 *  nesmí shodit appku. */
export async function migrateLegacyDataIfNeeded(): Promise<void> {
  try {
    const flag = await get<{ key: string; value: boolean }>("meta", MIGRATION_FLAG_KEY);
    if (flag?.value) return;
    // Nastavit flag hned, aby se migrace při chybě nezkoušela pořád dokola.
    await put("meta", { key: MIGRATION_FLAG_KEY, value: true });

    const legacyToolRecords: ToolRowsRecord[] = [];
    for (const op of TOOL_OPERATIONS) {
      const rows = readLegacyRows(`${LEGACY_PREFIX}nastroje:${op.id}`);
      if (rows.length > 0) {
        legacyToolRecords.push({ strojId: "legacy", opId: op.id, rows });
      }
    }

    const legacyByOp: Record<string, Row[]> = {};
    let hasLegacyRows = false;
    for (const op of OPERATIONS) {
      const rows = readLegacyRows(`${LEGACY_PREFIX}${op.id}`);
      legacyByOp[op.id] = rows;
      if (rows.length > 0) hasLegacyRows = true;
    }

    if (legacyToolRecords.length === 0 && !hasLegacyRows) return;

    const now = Date.now();
    const customerId = crypto.randomUUID();
    const inquiryId = crypto.randomUUID();
    const partId = crypto.randomUUID();
    await put("customers", { id: customerId, nazev: "Nezařazeno", createdAt: now });
    await put("inquiries", { id: inquiryId, customerId, nazev: "Migrovaná data", createdAt: now });
    await put("parts", { id: partId, inquiryId, cisloVykresu: "", nazev: "Díl 1", createdAt: now });

    for (const op of OPERATIONS) {
      const rows = legacyByOp[op.id];
      if (rows.length === 0) continue;
      await put("partOperationRows", { id: `${partId}:${op.id}`, partId, opId: op.id, rows });
    }

    if (legacyToolRecords.length > 0) {
      // Starý katalog nebyl vázaný na žádný stroj, ale nový katalog nástrojů ano -
      // založí se pro něj placeholder stroj, ať appka nástroje beze stroje neztratí
      // ani nemlčky nezahodí (bez vybraného stroje katalog nástrojů jinak nejde
      // nikde spravovat).
      const legacyMachineId = crypto.randomUUID();
      await put("machines", {
        id: legacyMachineId,
        nazev: "Migrovaný katalog (bez stroje)",
        operace: MACHINE_OPERATIONS.map((op) => op.id),
        createdAt: now,
      });
      const { tools, setupTemplates } = convertLegacyToolRows(legacyToolRecords);
      for (const [, rows] of Object.entries(tools)) {
        if (rows.length > 0) await put("tools", { strojId: legacyMachineId, rows });
      }
      for (const [, rows] of Object.entries(setupTemplates)) {
        if (rows.length > 0) await put("setupTemplates", { strojId: legacyMachineId, rows });
      }
    }
  } catch {
    // ignorovat - appka musí naběhnout i kdyby migrace selhala
  }
}

/** Jednorázově přeloží katalog nástrojů z dřívějšího tvaru (samostatný seznam na
 *  dvojici stroj+operace, store "toolRows") na nový obecný katalog nástrojů +
 *  šablony přípravných časů (store "tools"/"setupTemplates", viz lib/toolCatalog.ts).
 *  Fail-soft, stejně jako migrateLegacyDataIfNeeded výše. */
export async function migrateMachineCatalogIfNeeded(): Promise<void> {
  try {
    const flag = await get<{ key: string; value: boolean }>("meta", MACHINE_CATALOG_MIGRATION_FLAG_KEY);
    if (flag?.value) return;
    await put("meta", { key: MACHINE_CATALOG_MIGRATION_FLAG_KEY, value: true });

    const records = await getAll<ToolRowsRecord>("toolRows");
    if (records.length === 0) return;

    const { tools, setupTemplates } = convertLegacyToolRows(records);
    for (const [strojId, rows] of Object.entries(tools)) {
      const existing = await get<{ strojId: string; rows: Row[] }>("tools", strojId);
      await put("tools", { strojId, rows: [...(existing?.rows ?? []), ...rows] });
    }
    for (const [strojId, rows] of Object.entries(setupTemplates)) {
      const existing = await get<{ strojId: string; rows: Row[] }>("setupTemplates", strojId);
      await put("setupTemplates", { strojId, rows: [...(existing?.rows ?? []), ...rows] });
    }

    await clearStore("toolRows");
  } catch {
    // ignorovat - appka musí naběhnout i kdyby migrace selhala
  }
}
