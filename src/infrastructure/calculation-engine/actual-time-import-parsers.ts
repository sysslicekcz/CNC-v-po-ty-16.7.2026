import { ActualTimeImportRow } from "@/domain/calculation-engine/calibration/actual-time-import";

/**
 * Formátově specifické parsery syrových souborů na `ActualTimeImportRow[]`
 * (AP-MCE-001 Fáze G §5) - Infrastructure vrstva (I/O na hranici appky), NE
 * Domain - `runActualTimeImport()` (Domain) pracuje až s výstupem tady.
 *
 * XLSX parser NENÍ součástí tohohle MVP - vyžaduje binární parsing knihovnu
 * (`xlsx`/`exceljs`), která v projektu zatím není závislostí a nepřidává se
 * bez výslovného schválení (zdokumentovaná mezera, viz finální souhrn Fáze G
 * "zbývající rizika"). `ActualTimeImportSourceFormat` už `"xlsx"` obsahuje -
 * až se knihovna přidá, jde jen o další čistou funkci vedle těchhle dvou, ne
 * o změnu `ActualTimeImportService`/use casů.
 */

/** Jednoduchý, závorkami/uvozovkami vědomý CSV parser (RFC 4180 subset) -
 *  žádná externí závislost, dost pro čárkou/středníkem oddělené exporty
 *  běžných ERP/MES systémů. */
export function parseCsvToImportRows(csv: string, delimiter: "," | ";" = ","): ActualTimeImportRow[] {
  const lines = csv.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };

  const header = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line, index) => {
    const cells = parseLine(line);
    const rawData: Record<string, string | number | undefined> = {};
    header.forEach((column, columnIndex) => {
      rawData[column] = cells[columnIndex]?.trim();
    });
    return { rowNumber: index + 1, rawData };
  });
}

/** JSON vstup - pole objektů, klíče odpovídají "sloupcům" stejně jako u CSV. */
export function parseJsonToImportRows(json: string): ActualTimeImportRow[] {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error("parseJsonToImportRows: očekávané pole objektů na kořenové úrovni JSON.");
  }
  return parsed.map((item, index) => ({
    rowNumber: index + 1,
    rawData: item as Record<string, string | number | undefined>,
  }));
}
