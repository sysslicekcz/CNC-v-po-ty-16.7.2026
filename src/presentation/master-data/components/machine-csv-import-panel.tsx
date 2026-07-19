"use client";

import { useState } from "react";
import { readCsvFile } from "@/presentation/master-data/csv-utils";
import { describeMasterDataError } from "@/presentation/master-data/master-data-error-messages";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { CreateMachineUseCase } from "@/application/machines/create-machine-use-case";

/** Očekávané sloupce CSV importu strojů (Krok 5, zadání bod 41-44) - stejné
 *  názvy jako export produkuje, ať je round-trip export->úprava->import
 *  bezproblémový. Pořadí sloupců se nevynucuje, hledá se podle názvu hlavičky. */
export const MACHINE_CSV_HEADERS = [
  "code",
  "name",
  "designation",
  "category",
  "manufacturer",
  "model",
  "maxRpm",
  "maxPowerKw",
  "hourlyRateAmount",
  "hourlyRateCurrency",
  "note",
];

export interface PreviewRow {
  raw: Record<string, string>;
  valid: boolean;
  error?: string;
}

type ImportResult = { row: number; code: string; status: "created" | "failed"; message?: string };

/** Čistá validační logika preview řádků (vytažená mimo komponentu, aby šla
 *  otestovat bez React rendereru - stejný vzor jako `feature-gate-logic.ts`
 *  z Kroku 3.5/4). Komponenta samotná (`MachineCsvImportPanel`) tuhle funkci
 *  jen volá, žádnou vlastní validační větev NEDUPLIKUJE. */
export function buildPreview(headers: string[], rows: string[][]): PreviewRow[] {
  const indexByHeader = new Map(headers.map((h, i) => [h.trim(), i]));
  const get = (row: string[], key: string) => {
    const idx = indexByHeader.get(key);
    return idx === undefined ? "" : (row[idx] ?? "").trim();
  };

  return rows.map((row) => {
    const raw: Record<string, string> = {};
    for (const header of MACHINE_CSV_HEADERS) raw[header] = get(row, header);

    if (!raw.code) return { raw, valid: false, error: "Chybí 'code'." };
    if (!raw.name) return { raw, valid: false, error: "Chybí 'name'." };
    if (raw.hourlyRateAmount && Number.isNaN(Number(raw.hourlyRateAmount))) {
      return { raw, valid: false, error: "'hourlyRateAmount' není číslo." };
    }
    return { raw, valid: true };
  });
}

/**
 * Preview-před-commit CSV import strojů (Krok 5, zadání bod 41-44) - řádky se
 * NEJDŘÍV zparsují a zvalidují lokálně (bez zápisu), teprve po potvrzení se
 * po jednom aplikují přes `CreateMachineUseCase` (STEJNÝ use case jako ruční
 * formulář) - žádný přímý zápis do IndexedDB z importéru, žádná dočasná obálka
 * kolem repository. Není to jedna atomická DB transakce pro celý dávkový
 * import (repository na to nemá batch-transakční metodu a přidávat ji jen
 * kvůli importu by bylo overengineering, zadání bod 4) - každý řádek je
 * vlastní, nezávislá operace; případné selhání jednoho řádku (duplicitní kód,
 * licenční limit) nezablokuje ostatní, jen se vypíše ve výsledku (viz
 * docs/step-5/known-limitations.md).
 */
export function MachineCsvImportPanel({
  createMachineUseCase,
  onClose,
  onImported,
}: {
  createMachineUseCase: CreateMachineUseCase;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const handleFile = async (file: File) => {
    setParseError(null);
    setResults(null);
    const parsed = await readCsvFile(file);
    if (!parsed) {
      setParseError("Soubor je prázdný.");
      setPreview(null);
      return;
    }
    setPreview(buildPreview(parsed.headers, parsed.rows));
  };

  const validRows = preview?.filter((r) => r.valid) ?? [];

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    const rowResults: ImportResult[] = [];
    for (let i = 0; i < preview.length; i++) {
      const row = preview[i];
      if (!row.valid) continue;
      try {
        await createMachineUseCase.execute({
          code: row.raw.code,
          name: row.raw.name,
          designation: row.raw.designation || undefined,
          maxRpm: row.raw.maxRpm ? Number(row.raw.maxRpm) : undefined,
          hourlyRate: HourlyRate.of(Number(row.raw.hourlyRateAmount) || 0, row.raw.hourlyRateCurrency || "CZK"),
          note: row.raw.note || undefined,
        });
        rowResults.push({ row: i + 1, code: row.raw.code, status: "created" });
      } catch (e) {
        rowResults.push({ row: i + 1, code: row.raw.code, status: "failed", message: describeMasterDataError(e) });
      }
    }
    setResults(rowResults);
    setImporting(false);
    await onImported();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-surface p-4 text-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-medium">Import strojů z CSV</h2>
        <p className="mb-3 text-muted">
          Očekávané sloupce hlavičky: <code className="text-xs">{MACHINE_CSV_HEADERS.join(", ")}</code>. Povinné jsou jen
          <code className="text-xs"> code</code> a <code className="text-xs">name</code>.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="mb-3 text-xs"
        />
        {parseError && <p className="text-danger">{parseError}</p>}

        {preview && !results && (
          <>
            <p className="mb-2 text-muted">
              Nalezeno {preview.length} řádků, {validRows.length} platných.
            </p>
            <div className="mb-3 max-h-80 overflow-y-auto rounded border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-raised text-left">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Kód</th>
                    <th className="px-2 py-1">Název</th>
                    <th className="px-2 py-1">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-2 py-1">{i + 1}</td>
                      <td className="px-2 py-1">{row.raw.code || "—"}</td>
                      <td className="px-2 py-1">{row.raw.name || "—"}</td>
                      <td className={`px-2 py-1 ${row.valid ? "text-ok" : "text-danger"}`}>{row.valid ? "OK" : row.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              disabled={importing || validRows.length === 0}
              onClick={() => void handleImport()}
              className="rounded border border-accent px-3 py-1.5 text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {importing ? "Importuji…" : `Naimportovat ${validRows.length} řádků`}
            </button>
          </>
        )}

        {results && (
          <div className="mt-3">
            <p className="mb-2 text-muted">
              Vytvořeno {results.filter((r) => r.status === "created").length} z {results.length}.
            </p>
            <ul className="space-y-1 text-xs">
              {results.map((r) => (
                <li key={r.row} className={r.status === "created" ? "text-ok" : "text-danger"}>
                  Řádek {r.row} ({r.code}): {r.status === "created" ? "vytvořeno" : r.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 hover:bg-surface-raised">
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
