/**
 * Generický CSV import/export (Krok 5, zadání bod 40-45) - záměrně obecný,
 * ne pojmenovaný podle žádného konkrétního ERP (žádný "HeliosImport" apod.,
 * viz docs/adr/erp-agnostic-integration-layer.md - stejný princip i mimo
 * integrační vrstvu). Bez závislosti na XLSX knihovně (projekt žádnou nemá,
 * viz docs/audits/step-5-audit.md) - jen RFC4180-ish CSV.
 */

/** Rozparsuje CSV text na řádky/buňky - podporuje uvozovky, escapované `""`
 *  uvnitř uvozovek a čárky/nové řádky uvnitř uvozovaných buněk. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Znaky, kterými spreadsheet software (Excel/Sheets) interpretuje buňku
 *  jako vzorec - export je bezpečný proti "CSV/formula injection" (OWASP),
 *  ne jen proti syntaktickému rozbití CSV. Prefixuje nebezpečný začátek
 *  apostrofem, který spreadsheet zobrazí jako text, ne spustí jako vzorec. */
function sanitizeCsvCell(value: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  const safe = dangerous.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Serializuje řádky (první řádek = hlavička) na CSV text. */
export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\r\n");
}

/** Spustí stažení CSV souboru v prohlížeči (Blob + dočasný `<a>` odkaz). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Pohodlná zkratka: sestaví CSV z hlavičky + řádků a rovnou ho stáhne. */
export function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  downloadCsv(filename, stringifyCsv([headers, ...rows]));
}

/** Rozparsuje CSV soubor vybraný přes `<input type="file">` na řádky (bez
 *  hlavičky) + hlavičku zvlášť. Vrací `null`, pokud soubor neobsahuje ani
 *  hlavičku. */
export async function readCsvFile(file: File): Promise<{ headers: string[]; rows: string[][] } | null> {
  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.length === 0) return null;
  const [headers, ...rows] = parsed;
  return { headers, rows };
}
