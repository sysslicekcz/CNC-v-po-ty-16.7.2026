import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";

const MINUTE_FIELDS = ["totalElapsedTimeMin", "setupTimeMin", "machineTimeMin", "operatorTimeMin", "downtimeMin"] as const;

/**
 * `ActualTimeImportValidator` (AP-MCE-001 Fáze G §5) - ČISTÁ validace JEDNOHO
 * už-namapovaného řádku (`applyImportMapping()` výstup), BEZ znalosti formátu
 * souboru. Vrací jen `CalculationIssue[]` - žádná položka se `severity:
 * "error"` blokuje uložení řádku jako `ActualTimeRecord` (stejná konvence
 * jako `CalculationStrategy.validate()`).
 */
export function validateImportDraft(draft: Record<string, unknown>): CalculationIssue[] {
  const issues: CalculationIssue[] = [];

  const quantityCompleted = draft.quantityCompleted as number | undefined;
  if (quantityCompleted === undefined || !Number.isInteger(quantityCompleted) || quantityCompleted < 0) {
    issues.push(calibrationIssue("INVALID_ACTUAL_TIME", "'quantityCompleted' musí být nezáporné celé číslo.", "quantityCompleted"));
  } else if (quantityCompleted === 0) {
    issues.push(calibrationIssue("QUANTITY_COMPLETED_ZERO", "'quantityCompleted' je nula - normalizace na kus nebude možná.", "quantityCompleted"));
  }

  const startedAt = draft.productionStartedAt as string | undefined;
  const finishedAt = draft.productionFinishedAt as string | undefined;
  if (startedAt && finishedAt && startedAt > finishedAt) {
    issues.push(calibrationIssue("INVALID_TIME_RANGE", "'productionStartedAt' nesmí být po 'productionFinishedAt'.", "productionStartedAt"));
  }

  for (const field of MINUTE_FIELDS) {
    const value = draft[field] as number | undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      issues.push(calibrationIssue("NEGATIVE_DURATION", `'${field}' nesmí být záporné.`, field));
    }
  }

  return issues;
}
