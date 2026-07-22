import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { NormalizedActualTime } from "./actual-time-normalizer";
import type { VarianceMetric } from "./variance-tolerance-profile";
import { VarianceToleranceProfile } from "./variance-tolerance-profile";

export type VarianceDirection = "actual_lower" | "actual_equal" | "actual_higher";
export type VarianceSeverity = "negligible" | "low" | "medium" | "high" | "critical";

export interface VarianceMetricResult {
  metric: VarianceMetric;
  predictedValueMin: number;
  actualValueMin: number;
  absoluteVarianceMin: number;
  percentageVariance: number;
  direction: VarianceDirection;
  severity: VarianceSeverity;
  comparable: boolean;
  reasonIfNotComparable?: string;
}

export interface CalculationVarianceAnalysis {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  metrics: VarianceMetricResult[];
  analyzedAt: string;
}

/** Zúžený výřez `CalculationBreakdown` na to, co porovnání skutečně
 *  potřebuje (AP-MCE-001 Fáze G §8) - odvozeno VÝHRADNĚ z base-class getterů
 *  (§03), společných VŠEM strategiím (Turning/Milling/Grinding/Manual/
 *  Inspection) - `machineTimeMin`/`operatorTimeMin` jsou MVP aproximace
 *  (`unitTimeAdjusted`/`handlingTime` × quantity - žádná strategie
 *  nevystavuje čistě "strojní vs. operátorský" čas jako samostatné pole na
 *  spol. bázi), zdokumentovaná mez rozsahu (viz finální souhrn Fáze G). */
export interface PredictedTimeBreakdown {
  setupTimeMin: number;
  machineTimeMin: number;
  operatorTimeMin: number;
  handlingTimeMin: number;
  inspectionTimeMin: number;
  toolChangeTimeMin: number;
  unitTimeMin: number;
  batchTimeMin: number;
  totalTimeMin: number;
}

export function extractPredictedTimeBreakdown(breakdown: CalculationBreakdown): PredictedTimeBreakdown {
  const quantity = breakdown.quantity.pieces;
  const handlingTotalMin = breakdown.handlingTime.minutes * quantity;
  const inspectionTotalMin = breakdown.inOperationInspectionTime.minutes * quantity + breakdown.firstPieceInspectionTime.minutes + breakdown.finalInspectionTime.minutes + breakdown.measurementTime.minutes;

  return {
    setupTimeMin: breakdown.setupTime.minutes,
    machineTimeMin: breakdown.unitTimeAdjusted.minutes * quantity,
    operatorTimeMin: handlingTotalMin,
    handlingTimeMin: handlingTotalMin,
    inspectionTimeMin: inspectionTotalMin,
    toolChangeTimeMin: breakdown.toolChangeTime.minutes * breakdown.plannedToolChanges,
    unitTimeMin: breakdown.unitTimeAdjusted.minutes,
    batchTimeMin: breakdown.totalOperationTimeRaw.minutes,
    totalTimeMin: breakdown.totalOperationTime.minutes,
  };
}

function classifySeverity(absPercent: number, absMin: number, tolerance: VarianceToleranceProfile): VarianceSeverity {
  if (absMin < tolerance.absoluteMinimumToleranceMin) return "negligible";
  if (absPercent <= tolerance.negligiblePercent) return "negligible";
  if (absPercent <= tolerance.lowPercent) return "low";
  if (absPercent <= tolerance.mediumPercent) return "medium";
  if (absPercent <= tolerance.highPercent) return "high";
  return "critical";
}

function directionOf(predicted: number, actual: number): VarianceDirection {
  if (actual < predicted) return "actual_lower";
  if (actual > predicted) return "actual_higher";
  return "actual_equal";
}

function compareMetric(metric: VarianceMetric, predictedValueMin: number, actualValueMin: number | undefined, tolerance: VarianceToleranceProfile, notComparableReason?: string): VarianceMetricResult {
  if (actualValueMin === undefined || notComparableReason) {
    return {
      metric,
      predictedValueMin,
      actualValueMin: actualValueMin ?? 0,
      absoluteVarianceMin: 0,
      percentageVariance: 0,
      direction: "actual_equal",
      severity: "negligible",
      comparable: false,
      reasonIfNotComparable: notComparableReason ?? "Skutečná hodnota není k dispozici.",
    };
  }

  const absoluteVarianceMin = actualValueMin - predictedValueMin;
  const percentageVariance = predictedValueMin > 0 ? (absoluteVarianceMin / predictedValueMin) * 100 : actualValueMin === 0 ? 0 : 100;
  const severity = classifySeverity(Math.abs(percentageVariance), Math.abs(absoluteVarianceMin), tolerance);

  return {
    metric,
    predictedValueMin,
    actualValueMin,
    absoluteVarianceMin,
    percentageVariance,
    direction: directionOf(predictedValueMin, actualValueMin),
    severity,
    comparable: true,
  };
}

export interface AnalyzeVarianceInput {
  calculationId: string;
  calculationRevision: number;
  breakdown: CalculationBreakdown;
  normalizedActualTime: NormalizedActualTime;
  /** `NormalizedActualTime` (§7) nenese `toolChangeTimeMin` (§7 pole ho
   *  neobsahuje) - "predicted tool change vs. actual tool change" (§8)
   *  proto čte přímo ze zdrojového `ActualTimeRecord.toolChangeTimeMin`. */
  actualToolChangeTimeMin?: number;
  toleranceByMetric: Readonly<Record<VarianceMetric, VarianceToleranceProfile>>;
  now: string;
}

/**
 * `CalculationVarianceAnalysis` tvůrce (AP-MCE-001 Fáze G §8) - ČISTÁ funkce,
 * porovná PŘESNĚ devět metrik ze zadání. `toleranceByMetric` už vyřešil
 * Application-layer volající přes `resolveVarianceToleranceProfile()` pro
 * KAŽDOU metriku (repozitářový přístup smí mít jen use case, stejný princip
 * jako všude jinde v modulu).
 */
export function analyzeCalculationVariance(input: AnalyzeVarianceInput): CalculationVarianceAnalysis {
  const predicted = extractPredictedTimeBreakdown(input.breakdown);
  const actual = input.normalizedActualTime;

  const notComparable = actual.goodPieceUnitTimeMin === undefined ? "Chybí 'goodPieceUnitTimeMin' (nulový počet dobrých kusů)." : undefined;

  const metrics: VarianceMetricResult[] = [
    compareMetric("setup", predicted.setupTimeMin, actual.setupTimeMin, input.toleranceByMetric.setup),
    compareMetric("machine_time", predicted.machineTimeMin, actual.productiveMachineTimeMin, input.toleranceByMetric.machine_time),
    compareMetric("operator_time", predicted.operatorTimeMin, actual.productiveOperatorTimeMin, input.toleranceByMetric.operator_time),
    compareMetric("handling", predicted.handlingTimeMin, actual.handlingTimeMin, input.toleranceByMetric.handling),
    compareMetric("inspection", predicted.inspectionTimeMin, actual.inspectionTimeMin, input.toleranceByMetric.inspection),
    compareMetric(
      "tool_change",
      predicted.toolChangeTimeMin,
      input.actualToolChangeTimeMin,
      input.toleranceByMetric.tool_change,
      input.actualToolChangeTimeMin === undefined ? "Skutečný čas výměny nástroje nebyl evidován." : undefined
    ),
    compareMetric("unit_time", predicted.unitTimeMin, actual.goodPieceUnitTimeMin, input.toleranceByMetric.unit_time, notComparable),
    compareMetric("batch_time", predicted.batchTimeMin, actual.batchTimeMin, input.toleranceByMetric.batch_time),
    compareMetric("total_time", predicted.totalTimeMin, actual.elapsedTimeMin, input.toleranceByMetric.total_time),
  ];

  return {
    calculationId: input.calculationId,
    calculationRevision: input.calculationRevision,
    actualTimeRecordId: actual.actualTimeRecordId,
    metrics,
    analyzedAt: input.now,
  };
}
