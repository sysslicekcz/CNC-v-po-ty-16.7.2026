import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro kontrolní operace (AP-MCE-001 Fáze F
 * §15, přesné kódy ze zadání) - stejný vzor jako `MANUAL_ISSUE_SEVERITY`
 * (JEDNO místo, které váže kód na `severity`).
 */
export const INSPECTION_ISSUE_SEVERITY = {
  INVALID_INSPECTION_SUBTYPE: "error",
  INVALID_INSPECTION_LEVEL: "error",
  INVALID_CHARACTERISTIC_COUNT: "error",
  INVALID_SAMPLE_SIZE: "error",
  INVALID_SAMPLING_FREQUENCY: "error",
  INVALID_MEASUREMENT_TIME: "error",
  INSPECTION_EQUIPMENT_NOT_FOUND: "warning",
  INSPECTION_EQUIPMENT_UNSUITABLE: "warning",
  INSPECTION_RANGE_EXCEEDED: "warning",
  INSPECTION_ACCURACY_INSUFFICIENT: "warning",
  EQUIPMENT_CALIBRATION_EXPIRED: "warning",
  QUALIFICATION_MISSING: "warning",
  SAMPLING_RULE_DEFAULTED: "information",
  CMM_PROGRAM_TIME_UNKNOWN: "information",
  LOW_CONFIDENCE_RESULT: "recommendation",
} as const satisfies Record<string, CalculationSeverity>;

export type InspectionIssueCode = keyof typeof INSPECTION_ISSUE_SEVERITY;

export function inspectionIssue(code: InspectionIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: INSPECTION_ISSUE_SEVERITY[code], message, field };
}
