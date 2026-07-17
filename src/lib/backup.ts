"use client";

import { getAll, put, clearStore } from "./db";
import { Customer, Inquiry, Part, Position, Machine } from "./entities";
import { convertLegacyToolRows } from "./toolCatalog";
import { Row } from "./results";

interface PartOperationRowsRecord {
  id: string;
  partId: string;
  opId: string;
  rows: Row[];
}

/** Starý tvar katalogu nástrojů (verze 1-2 zálohy) - samostatný seznam na dvojici
 *  stroj+operace. Nahrazeno "tools"/"setupTemplates" (viz lib/toolCatalog.ts). */
interface LegacyToolRowsRecord {
  strojId?: string;
  opId: string;
  rows: Row[];
}

interface MachineRowsRecord {
  strojId: string;
  rows: Row[];
}

export interface BackupBundle {
  version: 1 | 2 | 3;
  exportedAt: string;
  customers: Customer[];
  inquiries: Inquiry[];
  parts: Part[];
  /** Chybí u záloh z verze 1 - při obnově se v tom případě polohy dopočítají výchozí (viz restoreBackup). */
  positions?: Position[];
  partOperationRows: PartOperationRowsRecord[];
  /** Nové od verze 3 - obecný katalog nástrojů a šablony přípravných časů, oba per stroj. */
  tools?: MachineRowsRecord[];
  setupTemplates?: MachineRowsRecord[];
  /** Jen u záloh do verze 2 - starý tvar katalogu nástrojů, při obnově se převede (viz restoreBackup). */
  toolRows?: LegacyToolRowsRecord[];
  /** Chybí u záloh z verze 1 (stroje ještě neexistovaly). */
  machines?: Machine[];
}

export async function exportBackup(): Promise<BackupBundle> {
  const [customers, inquiries, parts, positions, partOperationRows, tools, setupTemplates, machines] =
    await Promise.all([
      getAll<Customer>("customers"),
      getAll<Inquiry>("inquiries"),
      getAll<Part>("parts"),
      getAll<Position>("positions"),
      getAll<PartOperationRowsRecord>("partOperationRows"),
      getAll<MachineRowsRecord>("tools"),
      getAll<MachineRowsRecord>("setupTemplates"),
      getAll<Machine>("machines"),
    ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    customers,
    inquiries,
    parts,
    positions,
    partOperationRows,
    tools,
    setupTemplates,
    machines,
  };
}

export function downloadBackup(bundle: BackupBundle) {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cnc-casovac-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function isBackupBundle(data: unknown): data is BackupBundle {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const hasCatalog =
    (Array.isArray(d.tools) && Array.isArray(d.setupTemplates)) || Array.isArray(d.toolRows);
  return (
    Array.isArray(d.customers) &&
    Array.isArray(d.inquiries) &&
    Array.isArray(d.parts) &&
    Array.isArray(d.partOperationRows) &&
    hasCatalog
  );
}

export async function parseBackupFile(file: File): Promise<BackupBundle> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Soubor není platný JSON.");
  }
  if (!isBackupBundle(data)) throw new Error("Soubor neobsahuje platnou zálohu CNC Časovače.");
  return data;
}

/** Nahradí veškerá aktuální data zálohou - destruktivní, volající musí mít potvrzení od uživatele. */
export async function restoreBackup(bundle: BackupBundle): Promise<void> {
  await Promise.all([
    clearStore("customers"),
    clearStore("inquiries"),
    clearStore("parts"),
    clearStore("positions"),
    clearStore("partOperationRows"),
    clearStore("toolRows"),
    clearStore("tools"),
    clearStore("setupTemplates"),
    clearStore("machines"),
  ]);

  // Záloha do verze 2 měla katalog nástrojů ve starém tvaru (per stroj+operace) -
  // převede se stejnou konverzní logikou jako jednorázová migrace po startu appky
  // (viz lib/migrateLegacy.ts migrateMachineCatalogIfNeeded).
  let tools = bundle.tools ?? [];
  let setupTemplates = bundle.setupTemplates ?? [];
  if ((!bundle.tools || !bundle.setupTemplates) && bundle.toolRows && bundle.toolRows.length > 0) {
    const converted = convertLegacyToolRows(
      bundle.toolRows.map((r) => ({ strojId: r.strojId ?? "legacy", opId: r.opId, rows: r.rows }))
    );
    tools = Object.entries(converted.tools).map(([strojId, rows]) => ({ strojId, rows }));
    setupTemplates = Object.entries(converted.setupTemplates).map(([strojId, rows]) => ({ strojId, rows }));
  }

  await Promise.all([
    ...bundle.customers.map((c) => put("customers", c)),
    ...bundle.inquiries.map((i) => put("inquiries", i)),
    ...bundle.parts.map((p) => put("parts", p)),
    ...(bundle.positions ?? []).map((p) => put("positions", p)),
    ...bundle.partOperationRows.map((r) => put("partOperationRows", r)),
    ...tools.map((t) => put("tools", t)),
    ...setupTemplates.map((t) => put("setupTemplates", t)),
    ...(bundle.machines ?? []).map((m) => put("machines", m)),
  ]);
}
