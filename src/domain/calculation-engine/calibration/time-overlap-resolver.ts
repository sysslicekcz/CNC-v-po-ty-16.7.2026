import { ActualTimeSegment } from "./actual-time-segment";
import type { ActualTimeSegmentType } from "./actual-time-enums";
import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";

/** Segmenty, které se NIKDY nepočítají jako produktivní čas (§4 "waiting se
 *  nesmí automaticky přičíst k produktivnímu času", "downtime musí být
 *  oddělen od výrobního času", "break nesmí být automaticky považován za
 *  výrobní čas") - `interruption` má stejnou povahu (přerušení práce). */
const NON_PRODUCTIVE_TYPES: readonly ActualTimeSegmentType[] = ["waiting", "downtime", "break", "interruption", "unknown"];
/** Segmenty, které zabírají FYZICKÝ STROJ. */
const MACHINE_OCCUPYING_TYPES: readonly ActualTimeSegmentType[] = ["machine_cycle", "production", "tool_change", "fixture_change"];
/** Segmenty, které zabírají OBSLUHU. */
const OPERATOR_OCCUPYING_TYPES: readonly ActualTimeSegmentType[] = ["operator_attendance", "setup", "handling", "inspection", "cleaning", "rework"];

export interface TimeOverlapResolution {
  elapsedTimeMin: number;
  machineOccupiedTimeMin: number;
  operatorOccupiedTimeMin: number;
  productiveTimeMin: number;
  nonProductiveTimeMin: number;
  waitingTimeMin: number;
  downtimeMin: number;
  overlapTimeMin: number;
  unresolvedOverlapMin: number;
  /** Doplněno nad rámec minimálního seznamu polí ze zadání (§4 "unknown musí
   *  snížit confidence" v textu, ale návratový seznam pole `confidence`
   *  neobsahuje) - 0..1, stejná disciplína jako `ConfidenceBreakdown.finalScore`
   *  jinde v modulu. */
  confidence: number;
  warnings: CalculationIssue[];
}

interface Interval {
  startMs: number;
  endMs: number;
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** Sloučí (union) intervaly do minimálního počtu neplavajících se úseků a
 *  vrátí jejich celkovou délku v minutách - "pracuje s časovou osou, ne jen
 *  součtem délek" (§4). */
function unionDurationMin(intervals: Interval[]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  let totalMs = 0;
  let currentStart = sorted[0].startMs;
  let currentEnd = sorted[0].endMs;
  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    if (seg.startMs <= currentEnd) {
      currentEnd = Math.max(currentEnd, seg.endMs);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = seg.startMs;
      currentEnd = seg.endMs;
    }
  }
  totalMs += currentEnd - currentStart;
  return totalMs / 60000;
}

function intersectionMin(a: Interval, b: Interval): number {
  const start = Math.max(a.startMs, b.startMs);
  const end = Math.min(a.endMs, b.endMs);
  return end > start ? (end - start) / 60000 : 0;
}

function isMachineCycleOperatorPair(a: ActualTimeSegmentType, b: ActualTimeSegmentType): boolean {
  return (a === "machine_cycle" && b === "operator_attendance") || (a === "operator_attendance" && b === "machine_cycle");
}

function isInspectionMachineCyclePair(a: ActualTimeSegmentType, b: ActualTimeSegmentType): boolean {
  return (a === "inspection" && b === "machine_cycle") || (a === "machine_cycle" && b === "inspection");
}

/**
 * `TimeOverlapResolver` (AP-MCE-001 Fáze G §4) - ČISTÁ, deterministická
 * funkce nad `ActualTimeSegment[]` JEDNOHO `ActualTimeRecord`. Pracuje s
 * intervaly (union merge), ne prostým součtem `durationMin` (§3/§4) - dva
 * překrývající se segmenty stejného typu se NIKDY nepočítají dvakrát.
 */
export function resolveTimeOverlaps(segments: readonly ActualTimeSegment[]): TimeOverlapResolution {
  const warnings: CalculationIssue[] = [];

  if (segments.length === 0) {
    return {
      elapsedTimeMin: 0,
      machineOccupiedTimeMin: 0,
      operatorOccupiedTimeMin: 0,
      productiveTimeMin: 0,
      nonProductiveTimeMin: 0,
      waitingTimeMin: 0,
      downtimeMin: 0,
      overlapTimeMin: 0,
      unresolvedOverlapMin: 0,
      confidence: 1,
      warnings,
    };
  }

  const intervalOf = (s: ActualTimeSegment): Interval => ({ startMs: toMs(s.startedAt), endMs: toMs(s.finishedAt) });

  const allIntervals = segments.map(intervalOf);
  const elapsedTimeMin = unionDurationMin(allIntervals);

  const machineOccupiedTimeMin = unionDurationMin(segments.filter((s) => MACHINE_OCCUPYING_TYPES.includes(s.segmentType)).map(intervalOf));
  const operatorOccupiedTimeMin = unionDurationMin(segments.filter((s) => OPERATOR_OCCUPYING_TYPES.includes(s.segmentType)).map(intervalOf));
  const nonProductiveTimeMin = unionDurationMin(segments.filter((s) => NON_PRODUCTIVE_TYPES.includes(s.segmentType)).map(intervalOf));
  const productiveTimeMin = unionDurationMin(segments.filter((s) => !NON_PRODUCTIVE_TYPES.includes(s.segmentType)).map(intervalOf));
  const waitingTimeMin = unionDurationMin(segments.filter((s) => s.segmentType === "waiting").map(intervalOf));
  const downtimeMin = unionDurationMin(segments.filter((s) => s.segmentType === "downtime").map(intervalOf));

  let overlapTimeMin = 0;
  let unresolvedOverlapMin = 0;
  let hasUnknown = false;
  let unresolvedCount = 0;

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].segmentType === "unknown") hasUnknown = true;
    for (let j = i + 1; j < segments.length; j++) {
      const overlap = intersectionMin(intervalOf(segments[i]), intervalOf(segments[j]));
      if (overlap <= 0) continue;
      overlapTimeMin += overlap;

      const a = segments[i];
      const b = segments[j];
      const explicitlyAllowed = a.overlapsAllowed && b.overlapsAllowed;
      const allowedByRule = isMachineCycleOperatorPair(a.segmentType, b.segmentType) || isInspectionMachineCyclePair(a.segmentType, b.segmentType);

      if (explicitlyAllowed || allowedByRule) continue;

      if (a.employeeId && b.employeeId && a.employeeId === b.employeeId) {
        warnings.push(calibrationIssue("OVERLAPPING_EMPLOYEE_SEGMENTS", `Segmenty "${a.id}"/"${b.id}" stejného zaměstnance "${a.employeeId}" se časově překrývají (${overlap.toFixed(2)} min).`));
        unresolvedOverlapMin += overlap;
        unresolvedCount++;
      } else if (a.machineId && b.machineId && a.machineId === b.machineId) {
        warnings.push(calibrationIssue("OVERLAPPING_MACHINE_SEGMENTS", `Segmenty "${a.id}"/"${b.id}" stejného stroje "${a.machineId}" se časově překrývají (${overlap.toFixed(2)} min).`));
        unresolvedOverlapMin += overlap;
        unresolvedCount++;
      } else {
        warnings.push(calibrationIssue("UNRESOLVED_TIME_OVERLAP", `Segmenty "${a.id}"/"${b.id}" (${a.segmentType}/${b.segmentType}) se překrývají bez povoleného souběhu (${overlap.toFixed(2)} min).`));
        unresolvedOverlapMin += overlap;
        unresolvedCount++;
      }
    }
  }

  // §4 "unknown musí snížit confidence" - jen dopad na `confidence`, ne
  // samostatný warning kód (žádný z 31 kódů §26 tenhle konkrétní případ
  // nepojmenovává - overlapy výš svůj vlastní kód mají).
  let confidence = 1;
  if (hasUnknown) confidence -= 0.15;
  confidence -= Math.min(0.5, unresolvedCount * 0.1);
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    elapsedTimeMin,
    machineOccupiedTimeMin,
    operatorOccupiedTimeMin,
    productiveTimeMin,
    nonProductiveTimeMin,
    waitingTimeMin,
    downtimeMin,
    overlapTimeMin,
    unresolvedOverlapMin,
    confidence,
    warnings,
  };
}
