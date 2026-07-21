import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro ruční operace (AP-MCE-001 Fáze F §15) -
 * stejný vzor jako Fáze C/D/E (JEDNO místo, které váže kód na `severity`).
 */
export const MANUAL_ISSUE_SEVERITY = {
  INVALID_MANUAL_OPERATION_SUBTYPE: "error",
  INVALID_BASE_TIME: "error",
  INVALID_REPETITION_COUNT: "error",
  INVALID_QUANTITY_BASIS: "error",
  INVALID_COEFFICIENT: "error",
  REQUIRED_QUALIFICATION_MISSING: "warning",
  WORKSTATION_UNAVAILABLE: "warning",
  MANUAL_STANDARD_NOT_FOUND: "warning",
  MANUAL_STANDARD_DEFAULTED: "information",
  HISTORICAL_TIME_NOT_AVAILABLE: "information",
  LOW_CONFIDENCE_RESULT: "recommendation",
} as const satisfies Record<string, CalculationSeverity>;

export type ManualIssueCode = keyof typeof MANUAL_ISSUE_SEVERITY;

export function manualIssue(code: ManualIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: MANUAL_ISSUE_SEVERITY[code], message, field };
}
