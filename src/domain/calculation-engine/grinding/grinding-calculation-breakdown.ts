import type { GrindingSubtype, MachiningMode } from "./grinding-subtype";
import { GrindingFeatureGeometry } from "./grinding-feature-geometry";
import { CoefficientContribution } from "./grinding-coefficients";
import { ConfidenceBreakdown } from "./grinding-confidence";
import { WheelChangeAccountingResult } from "./wheel-change-accounting";
import { CalculationIssue } from "../entities/types";

/**
 * Rozpad JEDNOHO `GrindingFeature` (AP-MCE-001 Fáze E §12 "Pro každý
 * GrindingFeature vrať") - plochá, serializovatelná data, stejný vzor jako
 * Fáze C/D.
 */
export interface GrindingFeatureBreakdown {
  featureId: string;
  subtype: GrindingSubtype;
  machiningMode: MachiningMode;
  sourceGeometry: GrindingFeatureGeometry;
  startDimension?: number;
  targetDimension?: number;
  stockAllowanceMm: number;
  radialStockMm?: number;
  axialStockMm?: number;
  infeedPerPassMm: number;
  roughingPasses: number;
  finishingPasses: number;
  sparkOutPasses: number;
  totalPasses: number;
  effectiveStrokeLengthMm?: number;
  tableSpeedMmMin?: number;
  workpieceSpeedRpm?: number;
  wheelSpeedMps?: number;
  crossFeedMm?: number;
  totalStrokes?: number;
  removedVolumeMm3: number;
  rawGrindingTimeMin: number;
  adjustedGrindingTimeMin: number;
  dressingContributionMin: number;
  measurementContributionMin: number;
  sparkOutContributionMin: number;
  wheelReplacementContributionMin: number;
  coefficientBreakdown: CoefficientContribution[];
  warnings: CalculationIssue[];
  sourceOfEachResolvedParameter: Record<string, string>;
  approximationType?: "centerless" | "creep_feed";
  approximationReason?: string;
}

/**
 * Souhrnný rozpad CELÉ brusírenské operace (AP-MCE-001 Fáze E §12) - PŘIPOJUJE
 * se k existující `CalculationBreakdown` (Fáze A) jako `grindingDetail`
 * (ADITIVNÍ pole), stejný princip jako Fáze C/D `turningDetail`/`millingDetail`.
 */
export interface GrindingCalculationBreakdown {
  setupTimeMin: number;
  firstPieceInspectionTimeMin: number;
  finalInspectionTimeMin: number;
  rawGrindingTimeMin: number;
  adjustedGrindingTimeMin: number;
  handlingTimeMin: number;
  measurementTimeMin: number;
  dressingTimeMin: number;
  wheelReplacementTimeMin: number;
  fixtureChangeTimeMin: number;
  sparkOutTimeMin: number;
  auxiliaryTimeMin: number;
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
  features: GrindingFeatureBreakdown[];
  wheelChangeAccounting: WheelChangeAccountingResult;
  wheelDressingAccounting: {
    initialDressings: number;
    intervalDressings: number;
    manualDressings: number;
    conditionTriggeredDressings: number;
    totalDressings: number;
  };
  strategyVersion: string;
  algorithmVersion: string;
}
