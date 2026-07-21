import type { InspectionSubtype, InspectionLevel } from "./inspection-subtype";
import type { SamplingPlanResult } from "./inspection-sampling-strategy";
import { InspectionCoefficientContribution } from "./inspection-coefficients";
import { InspectionConfidenceBreakdown } from "./inspection-confidence";
import { CalculationIssue } from "../entities/types";

/**
 * Rozpad JEDNOHO `InspectionFeature` (AP-MCE-001 Fáze F §12) - plochá,
 * serializovatelná data, přesně pole ze zadání (+ `coefficientBreakdown`/
 * `strategyVersion`-style doplňky ve stejném duchu jako Fáze C/D/E).
 */
export interface InspectionFeatureBreakdown {
  featureId: string;
  subtype: InspectionSubtype;
  inspectionLevel: InspectionLevel;
  /** Počet kusů v CELÉ dávce (operace) - pro odkaz vedle `inspectedPieceCount`. */
  quantity: number;
  inspectedPieceCount: number;
  characteristicCount: number;
  /** Vyřešený sampling plán pro TENTO feature (§7 "sampleRule", §8 výsledek
   *  `resolveSampleCount()`) - nese mód, vzorec i slovní popis výběru. */
  sampleRule: SamplingPlanResult;
  preparationTimeMin: number;
  measurementTimeMin: number;
  handlingTimeMin: number;
  documentationTimeMin: number;
  reportTimeMin: number;
  /** §11 - odděleně od `measurementTimeMin` pro automatizovaná/CMM vybavení. */
  automaticCycleTimeMin: number;
  operatorAttendanceTimeMin: number;
  equipmentUsed?: string;
  coefficientBreakdown: InspectionCoefficientContribution[];
  warnings: CalculationIssue[];
  sourceOfEachResolvedParameter: Record<string, string>;
}

/**
 * Souhrnný rozpad CELÉ kontrolní operace (AP-MCE-001 Fáze F §10/§12) -
 * PŘIPOJUJE se k existující `CalculationBreakdown` (Fáze A) jako
 * `inspectionDetail` (ADITIVNÍ pole), stejný princip jako `turningDetail`/
 * .../`manualDetail`. Pole přesně podle zadání §12.
 */
export interface InspectionCalculationBreakdown {
  preparationTimeMin: number;
  equipmentSetupTimeMin: number;
  measurementTimeMin: number;
  handlingTimeMin: number;
  documentationTimeMin: number;
  reportTimeMin: number;
  cleanupTimeMin: number;
  /** §11 - agregováno přes všechny features, VŽDY odděleně od obsluhy
   *  (kapacitní plánování). */
  automaticCycleTimeMin: number;
  operatorAttendanceTimeMin: number;
  inspectedPieceCount: number;
  totalOperationTimeMin: number;
  effectiveUnitTimeMin: number;

  confidenceScore: number;
  confidenceBreakdown: InspectionConfidenceBreakdown;
  warnings: CalculationIssue[];
  recommendations: CalculationIssue[];
  features: InspectionFeatureBreakdown[];
  strategyVersion: string;
  algorithmVersion: string;
}
