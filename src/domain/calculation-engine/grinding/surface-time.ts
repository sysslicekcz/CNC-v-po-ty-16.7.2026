import { CalculationIssue } from "../entities/types";
import { GrindingFeature } from "./grinding-feature";
import { resolveSurfacePassStrategy } from "./pass-strategy";
import { grindingIssue } from "./grinding-issue-codes";
import { surfaceRemovedVolumeMm3 } from "./removed-volume";

export interface SurfaceTimeCalculationInput {
  feature: GrindingFeature;
  tableSpeedMmMin: number;
  rapidTraverseRateMmMin: number;
}

export interface SurfaceTimeResult {
  stockAllowanceMm: number;
  infeedPerPassMm: number;
  depthLayers: number;
  crossPasses: number;
  totalTableStrokes: number;
  removedVolumeMm3: number;
  rawGrindingTimeMin: number;
  rapidMoveTimeMin: number;
  auxiliaryContributionMin: number;
  sparkOutPasses: number;
  passCountManuallySpecified: boolean;
  usedDefaultInfeed: boolean;
  approximationType?: "creep_feed";
  approximationReason?: string;
  warnings: CalculationIssue[];
}

/** §6 MVP malá konstanta - čištění stolu (od třísek/brusného kalu) po každé
 *  hloubkové vrstvě. */
const TABLE_CLEANING_SEC_PER_LAYER = 3;
/** §6 "obrácení dílu" - MVP konstanta za JEDNO otočení. */
const PART_REVERSAL_MIN = 0.5;
/** §6 "creep-feed ... zjednodušený model podle délky, hloubky a posuvu" -
 *  celý přídavek se odebere JEDNÍM velmi pomalým průchodem (na rozdíl od
 *  mnoha mělkých vrstev u reciprocating modelu), MVP proto použije stejnou
 *  `pathPerStrokeMm/tableSpeedMmMin` formuli, ale jen `depthLayers = 1` a
 *  přirážkou `CREEP_FEED_APPROXIMATION_COEFFICIENT` (viz `grinding-
 *  coefficients.ts`) na úrovni strategie - MVP "zjednodušená aproximace",
 *  ne skutečná creep-feed fyzika (výrazně nižší posuv, jiná dynamika tepla).
 */
const CREEP_FEED_INFEED_PER_PASS_MULTIPLIER = 1;

/**
 * `calculateSurfaceFeatureTime` (AP-MCE-001 Fáze E §6) - ČISTÁ funkce, žádné
 * I/O. `pathPerStrokeMm = surfaceLengthMm + approachLengthMm + retractLengthMm`,
 * `rawGrindingTimeMin = timePerStrokeMin × totalTableStrokes` (§6 přesná
 * formule) - `totalTableStrokes` (§4: `depthLayers × crossPasses ×
 * strokesPerPass`) už v sobě nese přejezd mezi stopami i příčný posuv.
 */
export function calculateSurfaceFeatureTime(input: SurfaceTimeCalculationInput): SurfaceTimeResult {
  const { feature } = input;
  const g = feature.geometry;
  const warnings: CalculationIssue[] = [];
  const isCreepFeed = feature.subtype === "surface_creep_feed";

  const passInput = feature.passStrategy ?? {};
  const effectiveStockAllowanceMm = isCreepFeed ? g.stockAllowanceMm * CREEP_FEED_INFEED_PER_PASS_MULTIPLIER : g.stockAllowanceMm;
  const passes = isCreepFeed
    ? { ...resolveSurfacePassStrategy(effectiveStockAllowanceMm, g.surfaceWidthMm ?? 0, { ...passInput, infeedPerPassMm: effectiveStockAllowanceMm }), depthLayers: 1 }
    : resolveSurfacePassStrategy(effectiveStockAllowanceMm, g.surfaceWidthMm ?? 0, passInput);

  if (passes.passCountManuallySpecified) {
    warnings.push(grindingIssue("PASS_COUNT_MANUALLY_DEFINED", `Počet vrstev featuru "${feature.id}" byl zadán ručně.`));
  }
  if (isCreepFeed) {
    warnings.push(grindingIssue("CREEP_FEED_RESULT_APPROXIMATED", `Feature "${feature.id}": creep-feed broušení používá zjednodušený MVP model (délka/hloubka/posuv), nenahrazuje skutečnou creep-feed fyziku.`));
  }

  const pathPerStrokeMm = (g.surfaceLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
  const timePerStrokeMin = input.tableSpeedMmMin > 0 ? pathPerStrokeMm / input.tableSpeedMmMin : 0;
  const totalTableStrokes = isCreepFeed ? passes.crossPasses * passes.strokesPerPass + passes.sparkOutPasses : passes.totalTableStrokes;
  const rawGrindingTimeMin = timePerStrokeMin * totalTableStrokes;

  const repositions = Math.max(0, passes.depthLayers - 1);
  const rapidMoveTimeMin = input.rapidTraverseRateMmMin > 0 ? (repositions * (g.approachLengthMm + g.retractLengthMm)) / input.rapidTraverseRateMmMin : 0;

  const tableCleaningMin = (passes.depthLayers * TABLE_CLEANING_SEC_PER_LAYER) / 60;
  const partReversalMin = feature.partReversalRequired ? PART_REVERSAL_MIN : 0;

  const removedVolumeMm3 = surfaceRemovedVolumeMm3(g.surfaceLengthMm ?? 0, g.surfaceWidthMm ?? 0, g.stockAllowanceMm);

  return {
    stockAllowanceMm: g.stockAllowanceMm,
    infeedPerPassMm: passes.depthLayers > 0 ? g.stockAllowanceMm / passes.depthLayers : 0,
    depthLayers: passes.depthLayers,
    crossPasses: passes.crossPasses,
    totalTableStrokes,
    removedVolumeMm3,
    rawGrindingTimeMin,
    rapidMoveTimeMin,
    auxiliaryContributionMin: tableCleaningMin + partReversalMin,
    sparkOutPasses: passes.sparkOutPasses,
    passCountManuallySpecified: passes.passCountManuallySpecified,
    usedDefaultInfeed: passes.usedDefaultInfeed,
    approximationType: isCreepFeed ? "creep_feed" : undefined,
    approximationReason: isCreepFeed ? "Zjednodušený MVP model (délka × hloubka × posuv jedním pomalým průchodem), nenahrazuje skutečnou creep-feed fyziku." : undefined,
    warnings,
  };
}
