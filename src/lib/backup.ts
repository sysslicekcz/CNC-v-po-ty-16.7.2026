"use client";

import { getAll, put, clearStore } from "./db";
import { Customer, Inquiry, Part } from "./entities";
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
  version: 1;
  exportedAt: string;
  customers: Customer[];
  inquiries: Inquiry[];
  parts: Part[];
  partOperationRows: PartOperationRowsRecord[];
  toolRows: ToolRowsRecord[];
}

export async function exportBackup(): Promise<BackupBundle> {
  const [customers, inquiries, parts, partOperationRows, toolRows] = await Promise.all([
    getAll<Customer>("customers"),
    getAll<Inquiry>("inquiries"),
    getAll<Part>("parts"),
    getAll<PartOperationRowsRecord>("partOperationRows"),
    getAll<ToolRowsRecord>("toolRows"),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), customers, inquiries, parts, partOperationRows, toolRows };
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
    clearStore("partOperationRows"),
    clearStore("toolRows"),
  ]);
  await Promise.all([
    ...bundle.customers.map((c) => put("customers", c)),
    ...bundle.inquiries.map((i) => put("inquiries", i)),
    ...bundle.parts.map((p) => put("parts", p)),
    ...bundle.partOperationRows.map((r) => put("partOperationRows", r)),
    ...bundle.toolRows.map((t) => put("toolRows", t)),
  ]);
}
