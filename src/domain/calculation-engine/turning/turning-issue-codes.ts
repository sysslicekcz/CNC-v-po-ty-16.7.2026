import { CalculationSeverity } from "../enums/calculation-severity";
import { CalculationIssue } from "../entities/types";

/**
 * Katalog kódů `CalculationIssue` pro soustružnickou strategii (AP-MCE-001
 * Fáze C §12) - JEDNO místo, které váže kód na `severity`, aby se stejný
 * kód nikdy neobjevil s jinou závažností na dvou různých místech
 * `TurningCalculationStrategy`. Rozlišení error/warning/information/
 * recommendation (§12/§14 Fáze B precedens) drží tahle mapa, ne rozptýlené
 * literály.
 */
export const TURNING_ISSUE_SEVERITY = {
  INVALID_START_DIAMETER: "error",
  INVALID_END_DIAMETER: "error",
  INVALID_MACHINING_LENGTH: "error",
  INVALID_CUTTING_SPEED: "error",
  INVALID_FEED_PER_REVOLUTION: "error",
  INVALID_DEPTH_OF_CUT: "error",
  INVALID_PASS_COUNT: "error",
  INVALID_THREAD_PITCH: "error",
  INVALID_DRILL_DEPTH: "error",
  RPM_EXCEEDS_MACHINE_LIMIT: "error",
  RPM_BELOW_MACHINE_MINIMUM: "warning",
  FEED_RATE_ZERO: "error",
  MACHINE_NOT_TURNING_CAPABLE: "error",
  TOOL_NOT_TURNING_CAPABLE: "error",
  TOOL_MATERIAL_MISMATCH: "warning",
  TOOL_LIFE_UNKNOWN: "warning",
  MACHINE_POWER_EXCEEDED: "warning",
  MACHINE_TORQUE_EXCEEDED: "warning",
  WORK_ENVELOPE_EXCEEDED: "error",
  MANUAL_PASS_COUNT_USED: "information",
  CUTTING_CONDITION_DEFAULTED: "information",
  RPM_CLAMPED_TO_MACHINE_LIMIT: "warning",
  LOW_CONFIDENCE_RESULT: "recommendation",
} as const satisfies Record<string, CalculationSeverity>;

export type TurningIssueCode = keyof typeof TURNING_ISSUE_SEVERITY;

/** Sestaví `CalculationIssue` se `severity` odvozenou z `TURNING_ISSUE_
 *  SEVERITY` - volající nikdy nezadává `severity` ručně, takže ji nemůže
 *  omylem uvést nekonzistentně s katalogem. */
export function turningIssue(code: TurningIssueCode, message: string, field?: string): CalculationIssue {
  return { code, severity: TURNING_ISSUE_SEVERITY[code], message, field };
}
