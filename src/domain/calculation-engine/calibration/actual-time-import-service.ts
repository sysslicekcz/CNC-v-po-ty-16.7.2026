import { ActualTimeImportMapping, ActualTimeImportRow, ActualTimeImportResult, ActualTimeImportRowResult } from "./actual-time-import";
import { validateImportDraft } from "./actual-time-import-validator";

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Aplikuje `ActualTimeImportMapping.columnMapping` na JEDEN surový řádek
 *  (AP-MCE-001 Fáze G §5) - čistá projekce "název sloupce" -> "pole draftu",
 *  žádná validace (tu dělá `validateImportDraft` zvlášť, ať se dá volat i
 *  samostatně nad už namapovanými daty z ERP/MES adapteru). */
export function applyImportMapping(row: ActualTimeImportRow, mapping: ActualTimeImportMapping): Record<string, unknown> {
  const cm = mapping.columnMapping;
  const get = (col?: string): string | number | undefined => (col ? row.rawData[col] : undefined);

  return {
    externalOrderRaw: get(cm.externalOrderColumn),
    externalOperationRaw: get(cm.externalOperationColumn),
    machineId: get(cm.machineColumn) as string | undefined,
    workstationId: get(cm.workstationColumn) as string | undefined,
    employeeId: get(cm.employeeColumn) as string | undefined,
    quantityPlanned: toNumber(get(cm.quantityPlannedColumn)) ?? 0,
    quantityCompleted: toNumber(get(cm.quantityCompletedColumn)) ?? 0,
    quantityScrapped: toNumber(get(cm.quantityScrappedColumn)) ?? 0,
    productionStartedAt: get(cm.startedAtColumn) as string | undefined,
    productionFinishedAt: get(cm.finishedAtColumn) as string | undefined,
    totalElapsedTimeMin: toNumber(get(cm.durationMinColumn)),
    setupTimeMin: toNumber(get(cm.setupTimeMinColumn)),
    machineTimeMin: toNumber(get(cm.machineTimeMinColumn)),
    operatorTimeMin: toNumber(get(cm.operatorTimeMinColumn)),
    downtimeMin: toNumber(get(cm.downtimeMinColumn)),
    downtimeReason: get(cm.downtimeReasonColumn) as string | undefined,
    operationCategory: mapping.defaultOperationCategory,
  };
}

/**
 * `ActualTimeImportService` (AP-MCE-001 Fáze G §5) - ČISTÁ, deterministická
 * funkce nad JIŽ NAČTENÝMI řádky (`ActualTimeImportRow[]`, formátově
 * nezávislé - CSV/XLSX/JSON parsování bytů je Infrastructure starost, mimo
 * Domain). Nepíše nikam, jen vrátí `ActualTimeImportResult` - uložení
 * `ActualTimeRecord` z validních řádků dělá až `ImportActualTimesUseCase`
 * (Application vrstva, §22).
 */
export function runActualTimeImport(rows: readonly ActualTimeImportRow[], mapping: ActualTimeImportMapping): ActualTimeImportResult {
  const rowResults: ActualTimeImportRowResult[] = rows.map((row) => {
    const draft = applyImportMapping(row, mapping);
    const issues = validateImportDraft(draft);
    const hasBlockingError = issues.some((i) => i.severity === "error");
    return {
      rowNumber: row.rowNumber,
      status: hasBlockingError ? "invalid" : "valid",
      issues,
      mappedDraft: hasBlockingError ? undefined : draft,
    };
  });

  return {
    mappingId: mapping.id,
    totalRows: rows.length,
    validRowCount: rowResults.filter((r) => r.status === "valid").length,
    invalidRowCount: rowResults.filter((r) => r.status === "invalid").length,
    rows: rowResults,
  };
}
