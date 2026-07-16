"use client";

import { get, put } from "./db";
import { OPERATIONS, TOOL_OPERATIONS } from "./operations";
import { Row } from "./results";

const LEGACY_PREFIX = "cnc-casovac:";
const MIGRATION_FLAG_KEY = "legacyMigrated";

function readLegacyRows(key: string): Row[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Jednorázově přesune stará data z localStorage (ploché operace + nástroje)
 *  do IndexedDB. Kontury skončí v novém dílu "Nezařazeno / Migrovaná data / Díl 1",
 *  ať se nic neztratí. Fail-soft - chyba migrace nesmí shodit appku. */
export async function migrateLegacyDataIfNeeded(): Promise<void> {
  try {
    const flag = await get<{ key: string; value: boolean }>("meta", MIGRATION_FLAG_KEY);
    if (flag?.value) return;
    // Nastavit flag hned, aby se migrace při chybě nezkoušela pořád dokola.
    await put("meta", { key: MIGRATION_FLAG_KEY, value: true });

    for (const op of TOOL_OPERATIONS) {
      const rows = readLegacyRows(`${LEGACY_PREFIX}nastroje:${op.id}`);
      if (rows.length > 0) {
        await put("toolRows", { opId: op.id, rows });
      }
    }

    const legacyByOp: Record<string, Row[]> = {};
    let hasLegacyRows = false;
    for (const op of OPERATIONS) {
      const rows = readLegacyRows(`${LEGACY_PREFIX}${op.id}`);
      legacyByOp[op.id] = rows;
      if (rows.length > 0) hasLegacyRows = true;
    }
    if (!hasLegacyRows) return;

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
  } catch {
    // ignorovat - appka musí naběhnout i kdyby migrace selhala
  }
}
