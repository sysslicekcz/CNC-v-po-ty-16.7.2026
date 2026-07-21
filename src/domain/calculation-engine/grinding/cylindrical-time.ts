import { CalculationIssue } from "../entities/types";
import { GrindingFeature } from "./grinding-feature";
import { resolveCylindricalPassStrategy } from "./pass-strategy";
import { grindingIssue } from "./grinding-issue-codes";
import { cylindricalRemovedVolumeMm3 } from "./removed-volume";

export interface ResolveWorkpieceSpeedInput {
  explicitWorkpieceSpeedRpm?: number;
  resolvedWorkpieceSpeedRpm?: number;
  systemDefaultWorkpieceSpeedRpm: number;
  machineMinRpm?: number;
  machineMaxRpm?: number;
}

export interface ResolvedWorkpieceSpeed {
  rpm: number;
  source: string;
  clampedToMachineLimit: boolean;
  belowMachineMinimum: boolean;
  warnings: CalculationIssue[];
}

/** §5/§9 "min/max workpiece rpm" - ČISTÁ funkce, žádné I/O. Na rozdíl od Fáze
 *  C/D nástrojových otáček se `workpieceSpeedRpm` u broušení NEODVOZUJE ze
 *  vzorce podle průměru (§2 ho zavádí jako přímé technologické pole), jen se
 *  omezuje na limity stroje. */
export function resolveWorkpieceSpeed(input: ResolveWorkpieceSpeedInput): ResolvedWorkpieceSpeed {
  const warnings: CalculationIssue[] = [];
  let rpm: number;
  let source: string;
  if (input.explicitWorkpieceSpeedRpm !== undefined) {
    rpm = input.explicitWorkpieceSpeedRpm;
    source = "explicit";
  } else if (input.resolvedWorkpieceSpeedRpm !== undefined) {
    rpm = input.resolvedWorkpieceSpeedRpm;
    source = "resolved";
  } else {
    rpm = input.systemDefaultWorkpieceSpeedRpm;
    source = "system_default";
  }
  const isExplicit = input.explicitWorkpieceSpeedRpm !== undefined;

  let clampedToMachineLimit = false;
  if (input.machineMaxRpm !== undefined && rpm > input.machineMaxRpm && !isExplicit) {
    rpm = input.machineMaxRpm;
    clampedToMachineLimit = true;
    warnings.push(grindingIssue("RPM_CLAMPED_TO_MACHINE_LIMIT", `Vypočtené otáčky obrobku přesáhly maximum stroje (${input.machineMaxRpm} min⁻¹) - hodnota byla omezena.`));
  }
  const belowMachineMinimum = input.machineMinRpm !== undefined && rpm < input.machineMinRpm;

  return { rpm, source, clampedToMachineLimit, belowMachineMinimum, warnings };
}

export interface CylindricalTimeCalculationInput {
  feature: GrindingFeature;
  workpieceSpeedRpm: number;
  wheelSpeedMps: number;
  tableSpeedMmMin: number;
  plungeFeedMmMin: number;
  rapidTraverseRateMmMin: number;
}

export interface CylindricalTimeResult {
  radialStockMm: number;
  axialStockMm?: number;
  infeedPerPassMm: number;
  roughingPasses: number;
  finishingPasses: number;
  sparkOutPasses: number;
  totalPasses: number;
  effectiveStrokeLengthMm?: number;
  totalStrokes?: number;
  removedVolumeMm3: number;
  rawGrindingTimeMin: number;
  passCountManuallySpecified: boolean;
  usedDefaultInfeed: boolean;
  approximationType?: "centerless";
  approximationReason?: string;
  warnings: CalculationIssue[];
}

const TRAVERSE_SUBTYPES = new Set(["external_cylindrical", "internal_cylindrical", "traverse_grinding", "custom_path"]);
const PLUNGE_SUBTYPES = new Set(["plunge_grinding", "face_grinding"]);

/**
 * `calculateCylindricalFeatureTime` (AP-MCE-001 Fáze E §5) - ČISTÁ funkce,
 * žádné I/O. Rozhoduje mezi TRAVERSE (`effectiveStrokeLengthMm/tableSpeedMmMin
 * × strokeMultiplier × totalPasses`), PLUNGE (`radialStockMm/plungeFeedMmMin`)
 * a CENTERLESS modelem podle `feature.subtype` (§5 přesné formule pro
 * traverse/plunge).
 */
export function calculateCylindricalFeatureTime(input: CylindricalTimeCalculationInput): CylindricalTimeResult {
  const { feature } = input;
  const g = feature.geometry;
  const warnings: CalculationIssue[] = [];

  const radialStockMm =
    g.startDiameterMm !== undefined && g.endDiameterMm !== undefined ? Math.abs(g.startDiameterMm - g.endDiameterMm) / 2 : g.stockAllowanceMm;
  const axialStockMm = feature.subtype === "face_grinding" ? (g.axialAllowanceMm ?? g.stockAllowanceMm) : undefined;
  const stockForPasses = axialStockMm ?? radialStockMm;

  const passes = resolveCylindricalPassStrategy(stockForPasses, feature.passStrategy ?? {});
  if (passes.passCountManuallySpecified) {
    warnings.push(grindingIssue("PASS_COUNT_MANUALLY_DEFINED", `Počet průchodů featuru "${feature.id}" byl zadán ručně.`));
  }

  const removedVolumeMm3 =
    g.startDiameterMm !== undefined && g.endDiameterMm !== undefined && g.grindingLengthMm !== undefined
      ? cylindricalRemovedVolumeMm3(g.grindingLengthMm, g.startDiameterMm, g.endDiameterMm)
      : 0;

  if (feature.subtype === "centerless_through_feed") {
    const throughFeedLengthMm = g.grindingLengthMm ?? 0;
    const rawGrindingTimeMin = input.tableSpeedMmMin > 0 ? throughFeedLengthMm / input.tableSpeedMmMin : 0;
    warnings.push(grindingIssue("CENTERLESS_RESULT_APPROXIMATED", `Feature "${feature.id}": bezhroté průběžné broušení používá zjednodušený MVP model (průběžná délka/regulační rychlost).`));
    return {
      radialStockMm,
      axialStockMm,
      infeedPerPassMm: 0,
      roughingPasses: 0,
      finishingPasses: 0,
      sparkOutPasses: passes.sparkOutPasses,
      totalPasses: 1,
      removedVolumeMm3,
      rawGrindingTimeMin,
      passCountManuallySpecified: false,
      usedDefaultInfeed: false,
      approximationType: "centerless",
      approximationReason: "Bezhroté průběžné broušení: zjednodušený model (délka dílu / regulační rychlost), nenahrazuje plnou simulaci.",
      warnings,
    };
  }

  if (feature.subtype === "centerless_in_feed" || PLUNGE_SUBTYPES.has(feature.subtype)) {
    // §5 "rawGrindingTimeMin = radialStockMm / plungeFeedMmMin" - CELÝ
    // přídavek se dělí posuvem PŘÍMO (počet průchodů je jen INFORMATIVNÍ
    // odvození `infeedPerPassMm` v breakdownu, ne druhý multiplikátor času).
    const plungeTimeMin = input.plungeFeedMmMin > 0 ? stockForPasses / input.plungeFeedMmMin : 0;
    const approachRetractTimeMin = input.rapidTraverseRateMmMin > 0 ? (g.approachLengthMm + g.retractLengthMm) / input.rapidTraverseRateMmMin : 0;
    const isCenterless = feature.subtype === "centerless_in_feed";
    if (isCenterless) {
      warnings.push(grindingIssue("CENTERLESS_RESULT_APPROXIMATED", `Feature "${feature.id}": bezhroté zápichové broušení používá zjednodušený MVP model.`));
    }
    return {
      radialStockMm,
      axialStockMm,
      infeedPerPassMm: passes.totalPasses > 0 ? stockForPasses / passes.totalPasses : 0,
      roughingPasses: passes.roughingPasses,
      finishingPasses: passes.finishingPasses,
      sparkOutPasses: passes.sparkOutPasses,
      totalPasses: passes.totalPasses,
      removedVolumeMm3,
      rawGrindingTimeMin: plungeTimeMin + approachRetractTimeMin,
      passCountManuallySpecified: passes.passCountManuallySpecified,
      usedDefaultInfeed: passes.usedDefaultRoughingInfeed || passes.usedDefaultFinishingInfeed,
      approximationType: isCenterless ? "centerless" : undefined,
      approximationReason: isCenterless ? "Bezhroté zápichové broušení: zjednodušený model, nenahrazuje plnou simulaci regulačního kotouče." : undefined,
      warnings,
    };
  }

  // TRAVERSE model (§5 přesná formule).
  const effectiveStrokeLengthMm = (g.grindingLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
  const strokesPerPass = feature.passStrategy?.strokesPerPass ?? 2;
  const timePerStrokeMin = input.tableSpeedMmMin > 0 ? effectiveStrokeLengthMm / input.tableSpeedMmMin : 0;
  const timePerPassMin = timePerStrokeMin * strokesPerPass;
  const rawGrindingTimeMin = timePerPassMin * passes.totalPasses;
  const totalStrokes = strokesPerPass * passes.totalPasses;

  return {
    radialStockMm,
    axialStockMm,
    infeedPerPassMm: passes.totalPasses > 0 ? radialStockMm / passes.totalPasses : 0,
    roughingPasses: passes.roughingPasses,
    finishingPasses: passes.finishingPasses,
    sparkOutPasses: passes.sparkOutPasses,
    totalPasses: passes.totalPasses,
    effectiveStrokeLengthMm,
    totalStrokes,
    removedVolumeMm3,
    rawGrindingTimeMin,
    passCountManuallySpecified: passes.passCountManuallySpecified,
    usedDefaultInfeed: passes.usedDefaultRoughingInfeed || passes.usedDefaultFinishingInfeed,
    warnings,
  };
}

/** Registr podtypů, ke kterým se `calculateCylindricalFeatureTime` vztahuje -
 *  `GrindingCalculationStrategy` dispatcher (registrovaná strategie) ho
 *  používá k rozhodnutí, kterému internímu delegátovi předat celý vstup. */
export const CYLINDRICAL_SUBTYPES = new Set([...TRAVERSE_SUBTYPES, ...PLUNGE_SUBTYPES, "centerless_through_feed", "centerless_in_feed"]);
