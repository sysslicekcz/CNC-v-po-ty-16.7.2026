"use client";

import { exportToCsv } from "@/presentation/master-data/csv-utils";

export interface ExportCsvButtonProps {
  filename: string;
  headers: string[];
  rows: string[][];
  label?: string;
}

/** Jedno tlačítko "Export CSV" sdílené napříč všemi sekcemi kmenových dat
 *  (Krok 5, zadání bod 40) - stránka jen dodá hlavičku/řádky podle svých
 *  sloupců, sanitizace proti "formula injection" a stažení řeší
 *  `exportToCsv` na jednom místě. */
export function ExportCsvButton({ filename, headers, rows, label = "Export CSV" }: ExportCsvButtonProps) {
  return (
    <button
      onClick={() => exportToCsv(filename, headers, rows)}
      disabled={rows.length === 0}
      className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-50"
    >
      {label}
    </button>
  );
}
