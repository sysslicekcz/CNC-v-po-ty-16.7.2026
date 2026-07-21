import type { MillingSubtype, MachiningMode } from "./milling-subtype";
import { MillingFeatureGeometry } from "./milling-feature-geometry";
import { MillingPathKind } from "./milling-feature-cutting";
import { CoefficientContribution } from "./milling-coefficients";
import { ConfidenceBreakdown } from "./milling-confidence";
import { ToolChangeAccountingResult } from "./tool-change-accounting";
import { CalculationIssue } from "../entities/types";

/**
 * Rozpad JEDNOHO `MillingFeature` (AP-MCE-001 Fáze D §10 "Pro každý
 * MillingFeature vrať") - plochá, serializovatelná data, stejný vzor jako
 * Fáze C `TurningFeatureBreakdown`.
 */
export interface MillingFeatureBreakdown {
  featureId: string;
  subtype: MillingSubtype;
  machiningMode: MachiningMode;
  sourceGeometry: MillingFeatureGeometry;
  toolDiameterMm: number;
  teethCount: number;
  cuttingSpeedMMin: number;
  spindleSpeedRpm: number;
  spindleSpeedSource: "explicit" | "derived";
  feedPerToothMm: number;
  feedRateMmMin: number;
  feedSource: "explicit" | "derived";
  effectivePathLengthMm: number;
  pathStrategy: MillingPathKind;
  depthLayers: number;
  widthPasses: number;
  stepOverMm: number;
  stepDownMm: number;
  rawCuttingTimeMin: number;
  adjustedCuttingTimeMin: number;
  rapidMoveTimeMin: number;
  plungeTimeMin: number;
  toolChangeContributionMin: number;
  measurementContributionMin: number;
  toolWearContributionMin: number;
  coefficientBreakdown: CoefficientContribution[];
  warnings: CalculationIssue[];
  /** §10 "sourceOfEachResolvedParameter" - odkud pochází KAŽDÁ vyřešená
   *  hodnota, klíčované jménem parametru (`cuttingSpeed`, `feedPerTooth`,
   *  `spindleSpeed`, `passCount`, ...). */
  sourceOfEachResolvedParameter: Record<string, string>;
  /** §4/§10 "3D aproximace" - `undefined` mimo `three_d`. */
  approximationType?: "three_d_surface";
  approximationReason?: string;
}

/**
 * Souhrnný rozpad CELÉ frézovací operace (AP-MCE-001 Fáze D §10) - PŘIPOJUJE
 * se k existující `CalculationBreakdown` (Fáze A) jako `millingDetail`
 * (ADITIVNÍ pole), NENAHRAZUJE ji - `CalculationBreakdown.totalOperationTime`
 * zůstává jediným zdrojem pravdy pro celkový čas, tenhle typ nese jen
 * VYSVĚTLENÍ, jak k němu strategie došla.
 */
export interface MillingCalculationBreakdown {
  setupTimeMin: number;
  firstPieceInspectionTimeMin: number;
  finalInspectionTimeMin: number;
  rawCuttingTimeMin: number;
  adjustedCuttingTimeMin: number;
  rapidMoveTimeMin: number;
  plungeTimeMin: number;
  handlingTimeMin: number;
  measurementTimeMin: number;
  toolChangeTimeMin: number;
  fixtureChangeTimeMin: number;
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
  features: MillingFeatureBreakdown[];
  toolChangeAccounting: ToolChangeAccountingResult;
  strategyVersion: string;
  algorithmVersion: string;
}
