import type { ManualOperationSubtype, ManualQuantityBasis, ManualTimeBasis } from "./manual-operation-subtype";
import { CoefficientContribution } from "./manual-coefficients";
import { ConfidenceBreakdown } from "./manual-confidence";
import { CalculationIssue } from "../entities/types";

/**
 * Rozpad JEDNOHO `ManualOperationFeature` (AP-MCE-001 Fáze F §12) - plochá,
 * serializovatelná data, stejný vzor jako Fáze C/D/E.
 */
export interface ManualOperationFeatureBreakdown {
  featureId: string;
  subtype: ManualOperationSubtype;
  quantityBasis: ManualQuantityBasis;
  repetitionCount: number;
  baseTimeMin: number;
  adjustedTimeMin: number;
  /** §3/§12 "source" - odkud pochází `baseTimeMin` (`ManualTimeBasis`, nebo
   *  konkrétní `ManualTimeStandardSource`, pokud byl standard použit). */
  source: ManualTimeBasis | string;
  coefficientBreakdown: CoefficientContribution[];
  qualificationRequirement?: string;
  warnings: CalculationIssue[];
  sourceOfEachResolvedParameter: Record<string, string>;
}

/**
 * Souhrnný rozpad CELÉ ruční operace (AP-MCE-001 Fáze F §12) - PŘIPOJUJE se
 * k existující `CalculationBreakdown` (Fáze A) jako `manualDetail` (ADITIVNÍ
 * pole), stejný princip jako Fáze C/D/E `turningDetail`/... .
 */
export interface ManualCalculationBreakdown {
  setupTimeMin: number;
  preparationTimeMin: number;
  rawManualTimeMin: number;
  adjustedManualTimeMin: number;
  handlingTimeMin: number;
  auxiliaryTimeMin: number;
  cleanupTimeMin: number;
  waitingTimeMin: number;
  allowanceTimeMin: number;
  unitTimeMin: number;
  batchVariableTimeMin: number;
  batchFixedTimeMin: number;
  totalOperationTimeMin: number;
  effectiveUnitTimeMin: number;
  confidenceScore: number;
  confidenceBreakdown: ConfidenceBreakdown;
  warnings: CalculationIssue[];
  recommendations: CalculationIssue[];
  features: ManualOperationFeatureBreakdown[];
  strategyVersion: string;
  algorithmVersion: string;
}
