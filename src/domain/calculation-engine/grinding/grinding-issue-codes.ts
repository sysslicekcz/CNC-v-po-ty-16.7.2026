import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro brusírenské strategie (AP-MCE-001 Fáze
 * E §15) - stejný vzor jako Fáze C/D (JEDNO místo, které váže kód na
 * `severity`).
 */
export const GRINDING_ISSUE_SEVERITY = {
  INVALID_GRINDING_SUBTYPE: "error",
  INVALID_STOCK_ALLOWANCE: "error",
  INVALID_START_DIAMETER: "error",
  INVALID_END_DIAMETER: "error",
  INVALID_GRINDING_LENGTH: "error",
  INVALID_SURFACE_GEOMETRY: "error",
  INVALID_WHEEL_DIAMETER: "error",
  INVALID_WHEEL_WIDTH: "error",
  INVALID_WHEEL_SPEED: "error",
  INVALID_WORKPIECE_SPEED: "error",
  INVALID_TABLE_SPEED: "error",
  INVALID_CROSS_FEED: "error",
  INVALID_INFEED_PER_PASS: "error",
  INVALID_PASS_COUNT: "error",
  INVALID_SPARK_OUT_COUNT: "error",
  INVALID_DRESSING_INTERVAL: "error",
  INVALID_MEASUREMENT_FREQUENCY: "error",
  MACHINE_NOT_CYLINDRICAL_GRINDING_CAPABLE: "error",
  MACHINE_NOT_SURFACE_GRINDING_CAPABLE: "error",
  MACHINE_NOT_INTERNAL_GRINDING_CAPABLE: "error",
  MACHINE_NOT_CENTERLESS_CAPABLE: "error",
  WHEEL_MATERIAL_MISMATCH: "warning",
  WHEEL_GEOMETRY_MISMATCH: "error",
  WHEEL_SPEED_EXCEEDS_LIMIT: "error",
  MACHINE_POWER_EXCEEDED: "warning",
  WORK_ENVELOPE_EXCEEDED: "error",
  PRECISION_CAPABILITY_INSUFFICIENT: "error",
  DRESSING_INTERVAL_DEFAULTED: "information",
  WHEEL_LIFE_UNKNOWN: "warning",
  CENTERLESS_RESULT_APPROXIMATED: "information",
  CREEP_FEED_RESULT_APPROXIMATED: "information",
  PASS_COUNT_MANUALLY_DEFINED: "information",
  LOW_CONFIDENCE_RESULT: "recommendation",
  // Doplňkové kódy - stejná role jako Fáze C/D (neuvedené v §15 explicitně,
  // ale nutné pro konzistenci s existující severitní klasifikací §14/§18).
  RPM_CLAMPED_TO_MACHINE_LIMIT: "warning",
  CUTTING_CONDITION_DEFAULTED: "information",
} as const satisfies Record<string, CalculationSeverity>;

export type GrindingIssueCode = keyof typeof GRINDING_ISSUE_SEVERITY;

/** Sestaví `CalculationIssue` se `severity` odvozenou z `GRINDING_ISSUE_
 *  SEVERITY` - volající nikdy nezadává `severity` ručně. */
export function grindingIssue(code: GrindingIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: GRINDING_ISSUE_SEVERITY[code], message, field };
}
