import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro frézovací strategii (AP-MCE-001 Fáze D
 * §13) - JEDNO místo, které váže kód na `severity`, stejný vzor jako Fáze C
 * `TURNING_ISSUE_SEVERITY` (žádný kód se nesmí objevit s jinou závažností na
 * dvou různých místech `MillingCalculationStrategy`).
 */
export const MILLING_ISSUE_SEVERITY = {
  INVALID_TOOL_DIAMETER: "error",
  INVALID_TEETH_COUNT: "error",
  INVALID_CUTTING_SPEED: "error",
  INVALID_FEED_PER_TOOTH: "error",
  INVALID_FEED_RATE: "error",
  INVALID_PATH_LENGTH: "error",
  INVALID_STEP_OVER: "error",
  INVALID_STEP_DOWN: "error",
  INVALID_DEPTH_OF_CUT: "error",
  INVALID_WIDTH_OF_CUT: "error",
  INVALID_POCKET_GEOMETRY: "error",
  INVALID_CONTOUR_LENGTH: "error",
  INVALID_SLOT_GEOMETRY: "error",
  INVALID_HOLE_COUNT: "error",
  INVALID_DRILL_DEPTH: "error",
  INVALID_THREAD_PITCH: "error",
  RPM_EXCEEDS_MACHINE_LIMIT: "error",
  RPM_BELOW_MACHINE_MINIMUM: "warning",
  FEED_EXCEEDS_MACHINE_LIMIT: "error",
  MACHINE_NOT_MILLING_CAPABLE: "error",
  MACHINE_AXIS_COUNT_INSUFFICIENT: "error",
  RIGID_TAPPING_UNAVAILABLE: "error",
  THREE_D_CAPABILITY_UNAVAILABLE: "error",
  TOOL_NOT_MILLING_CAPABLE: "error",
  TOOL_MATERIAL_MISMATCH: "warning",
  TOOL_TOO_LARGE_FOR_FEATURE: "error",
  TOOL_TOO_SHORT_FOR_DEPTH: "error",
  TOOL_LIFE_UNKNOWN: "warning",
  MACHINE_POWER_EXCEEDED: "warning",
  WORK_ENVELOPE_EXCEEDED: "error",
  CUTTING_CONDITION_DEFAULTED: "information",
  PATH_LENGTH_APPROXIMATED: "information",
  THREE_D_RESULT_APPROXIMATED: "information",
  RPM_CLAMPED_TO_MACHINE_LIMIT: "warning",
  FEED_CLAMPED_TO_MACHINE_LIMIT: "warning",
  LOW_CONFIDENCE_RESULT: "recommendation",
  // Doplňkové kódy - stejná role jako Fáze C `MANUAL_PASS_COUNT_USED`/
  // `MACHINE_TORQUE_EXCEEDED` (neuvedené v §13 explicitně, ale nutné pro
  // konzistenci s existující severitní klasifikací §12/§18).
  MANUAL_PASS_COUNT_USED: "information",
  MACHINE_TORQUE_EXCEEDED: "warning",
} as const satisfies Record<string, CalculationSeverity>;

export type MillingIssueCode = keyof typeof MILLING_ISSUE_SEVERITY;

/** Sestaví `CalculationIssue` se `severity` odvozenou z `MILLING_ISSUE_
 *  SEVERITY` - volající nikdy nezadává `severity` ručně. */
export function millingIssue(code: MillingIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: MILLING_ISSUE_SEVERITY[code], message, field };
}
