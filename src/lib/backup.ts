"use client";

import { getAll, put, clearStore } from "./db";
import { Customer, Inquiry, Part, Position, Machine } from "./entities";
import { Row } from "./results";

interface PartOperationRowsRecord {
  id: string;
  partId: string;
  opId: string;
  rows: Row[];
}

interface ToolRowsRecord {
  opId: string;
  rows: Row[];
}

export interface BackupBundle {
  version: 1 | 2;
  exportedAt: string;
  customers: Customer[];
  inquiries: Inquiry[];
  parts: Part[];
  /** Chybí u záloh z verze 1 - při obnově se v tom případě polohy dopočítají výchozí (viz restoreBackup). */
  positions?: Position[];
  partOperationRows: PartOperationRowsRecord[];
  toolRows: ToolRowsRecord[];
  /** Chybí u záloh z verze 1 (stroje ještě neexistovaly). */
  machines?: Machine[];
}

export async function exportBackup(): Promise<BackupBundle> {
  const [customers, inquiries, parts, positions, partOperationRows, toolRows, machines] = await Promise.all([
    getAll<Customer>("customers"),
    getAll<Inquiry>("inquiries"),
    getAll<Part>("parts"),
    getAll<Position>("positions"),
    getAll<PartOperationRowsRecord>("partOperationRows"),
    getAll<ToolRowsRecord>("toolRows"),
    getAll<Machine>("machines"),
  ]);
  return { version: 2, exportedAt: new Date().toISOString(), customers, inquiries, parts, positions, partOperationRows, toolRows, machines };
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
  return (
    Array.isArray(d.customers) &&
    Array.isArray(d.inquiries) &&
    Array.isArray(d.parts) &&
    Array.isArray(d.partOperationRows) &&
    Array.isArray(d.toolRows)
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
    clearStore("machines"),
  ]);
  await Promise.all([
    ...bundle.customers.map((c) => put("customers", c)),
    ...bundle.inquiries.map((i) => put("inquiries", i)),
    ...bundle.parts.map((p) => put("parts", p)),
    ...(bundle.positions ?? []).map((p) => put("positions", p)),
    ...bundle.partOperationRows.map((r) => put("partOperationRows", r)),
    ...bundle.toolRows.map((t) => put("toolRows", t)),
    ...(bundle.machines ?? []).map((m) => put("machines", m)),
  ]);
}
