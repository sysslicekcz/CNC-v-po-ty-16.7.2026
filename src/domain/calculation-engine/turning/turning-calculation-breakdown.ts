import type { TurningSubtype, MachiningMode } from "./turning-subtype";
import { TurningFeatureGeometry } from "./turning-feature-geometry";
import { EffectiveDiameterSource } from "./effective-diameter";
import { CoefficientContribution } from "./turning-coefficients";
import { ConfidenceBreakdown } from "./turning-confidence";
import { ToolChangeAccountingResult } from "./tool-change-accounting";
import { CalculationIssue } from "../entities/types";

/**
 * Rozpad JEDNOHO `TurningFeature` (AP-MCE-001 Fáze C §9 "Pro každý Turning
 * Feature vrať") - plochá, serializovatelná data (ne hodnotový objekt s
 * validací - je to VÝSTUP výpočtu, ne vstup, který by potřeboval vlastní
 * invarianty).
 */
export interface TurningFeatureBreakdown {
  featureId: string;
  subtype: TurningSubtype;
  machiningMode: MachiningMode;
  sourceGeometry: TurningFeatureGeometry;
  effectiveDiameterMm: number;
  cuttingSpeedMMin: number;
  spindleSpeedRpm: number;
  spindleSpeedSource: EffectiveDiameterSource;
  feedPerRevolutionMm: number;
  feedRateMmMin: number;
  cuttingLengthMm: number;
  radialStockMm: number;
  axialStockMm: number;
  roughingPasses: number;
  finishingPasses: number;
  springPasses: number;
  totalPasses: number;
  cuttingTimePerPassMin: number;
  totalCuttingTimeMin: number;
  dwellTimeMin: number;
  toolChangeContributionMin: number;
  measurementContributionMin: number;
  coefficientBreakdown: CoefficientContribution[];
  warnings: CalculationIssue[];
  /** §9 "sourceOfEachResolvedParameter" - odkud pochází KAŽDÁ vyřešená
   *  hodnota (`"explicit"`, `"cutting_condition"`, `"tool_default"`,
   *  `"material_default"`, `"system_default"`, `"input"`, ...), klíčované
   *  jménem parametru (`cuttingSpeed`, `feedPerRevolution`, `passCount`, ...). */
  sourceOfEachResolvedParameter: Record<string, string>;
}

/**
 * Souhrnný rozpad CELÉ soustružnické operace (AP-MCE-001 Fáze C §9) - PŘIPOJUJE
 * se k existující `CalculationBreakdown` (Fáze A) jako `turningDetail`
 * (ADITIVNÍ pole, viz komentář u `CalculationBreakdownProps.turningDetail`),
 * NENAHRAZUJE ji - `CalculationBreakdown.totalOperationTime` (Layer 1/2/3
 * skládání z Fáze A) zůstává jediným zdrojem pravdy pro celkový čas, tenhle
 * typ nese jen VYSVĚTLENÍ, jak k němu strategie došla (§9: "výsledek nesmí
 * být pouze jedno číslo").
 */
export interface TurningCalculationBreakdown {
  setupTimeMin: number;
  firstPieceInspectionTimeMin: number;
  finalInspectionTimeMin: number;
  rawCuttingTimeMin: number;
  adjustedCuttingTimeMin: number;
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
  features: TurningFeatureBreakdown[];
  toolChangeAccounting: ToolChangeAccountingResult;
  strategyVersion: string;
  algorithmVersion: string;
}
