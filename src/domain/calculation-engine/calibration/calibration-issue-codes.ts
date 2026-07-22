import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro celý modul skutečných časů/odchylek/
 * kalibrace (AP-MCE-001 Fáze G §26, přesných 31 kódů ze zadání) - stejný
 * vzor jako `MANUAL_ISSUE_SEVERITY`/`INSPECTION_ISSUE_SEVERITY` (Fáze F):
 * JEDNO místo, které váže kód na `severity`, sdílené napříč `TimeOverlap
 * Resolver`, `ActualTimeNormalizer`, `CalculationVarianceAnalysis`,
 * `CalibrationSample`, `CalibrationOutlierDetector`, `CalibrationSafetyRules`
 * atd. - žádný z nich si nevymýšlí vlastní katalog.
 */
export const CALIBRATION_ISSUE_SEVERITY = {
  ACTUAL_TIME_NOT_FOUND: "error",
  INVALID_ACTUAL_TIME: "error",
  INVALID_TIME_RANGE: "error",
  NEGATIVE_DURATION: "error",
  OVERLAPPING_EMPLOYEE_SEGMENTS: "warning",
  OVERLAPPING_MACHINE_SEGMENTS: "warning",
  UNRESOLVED_TIME_OVERLAP: "warning",
  QUANTITY_COMPLETED_ZERO: "warning",
  ACTUAL_TIME_NOT_APPROVED: "warning",
  CALCULATION_MATCH_NOT_FOUND: "warning",
  CALCULATION_MATCH_AMBIGUOUS: "warning",
  LOW_MATCH_CONFIDENCE: "warning",
  NORMALIZATION_FAILED: "error",
  VARIANCE_NOT_COMPARABLE: "information",
  VARIANCE_CRITICAL: "recommendation",
  CALIBRATION_SAMPLE_INVALID: "error",
  CALIBRATION_SAMPLE_EXCLUDED: "information",
  CALIBRATION_SAMPLE_CROSS_TENANT: "error",
  INSUFFICIENT_SAMPLE_COUNT: "error",
  INSUFFICIENT_EFFECTIVE_SAMPLE_COUNT: "error",
  CALIBRATION_OUTLIER_DETECTED: "warning",
  CALIBRATION_COEFFICIENT_OUT_OF_RANGE: "error",
  CALIBRATION_CHANGE_TOO_LARGE: "error",
  CALIBRATION_BACKTEST_FAILED: "error",
  CALIBRATION_VALIDATION_SET_WORSENED: "error",
  CALIBRATION_PROFILE_NOT_APPROVED: "error",
  CALIBRATION_PROFILE_NOT_ACTIVE: "error",
  CALIBRATION_SCOPE_CONFLICT: "error",
  CALIBRATION_PROFILE_VERSION_CONFLICT: "error",
  SHADOW_MODE_RESULT_UNAVAILABLE: "information",
  CROSS_TENANT_ACCESS: "error",
} as const satisfies Record<string, CalculationSeverity>;

export type CalibrationIssueCode = keyof typeof CALIBRATION_ISSUE_SEVERITY;

export function calibrationIssue(code: CalibrationIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: CALIBRATION_ISSUE_SEVERITY[code], message, field };
}
