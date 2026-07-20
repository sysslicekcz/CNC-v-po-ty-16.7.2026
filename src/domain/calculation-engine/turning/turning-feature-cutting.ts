import { CalculationIssue } from "../entities/types";
import { TurningFeature } from "./turning-feature";
import { resolveEffectiveDiameterMm, EffectiveDiameterSource } from "./effective-diameter";
import { resolveSpindleSpeed } from "./spindle-speed-resolver";
import { resolvePassStrategy } from "./pass-strategy";
import { turningIssue } from "./turning-issue-codes";

export interface FeatureCuttingCalculationInput {
  feature: TurningFeature;
  cuttingSpeedMMin: number;
  feedPerRevolutionMm: number;
  machineMinRpm?: number;
  machineMaxRpm?: number;
  toolMaxCuttingSpeedMMin?: number;
}

export interface FeatureCuttingResult {
  effectiveDiameterMm: number;
  spindleSpeedSource: EffectiveDiameterSource;
  cuttingSpeedMMin: number;
  spindleSpeedRpm: number;
  feedPerRevolutionMm: number;
  feedRateMmMin: number;
  cuttingLengthMm: number;
  radialStockMm: number;
  axialStockMm: number;
  roughingPasses: number;
  finishingPasses: number;
  springPasses: number;
  totalPasses: number;
  passCountManuallySpecified: boolean;
  usedDefaultRoughingDepthOfCut: boolean;
  cuttingTimePerPassMin: number;
  totalCuttingTimeMin: number;
  dwellTimeMin: number;
  clampedToMachineLimit: boolean;
  clampedToToolLimit: boolean;
  belowMachineMinimum: boolean;
  warnings: CalculationIssue[];
}

interface SubtypeLengthPlan {
  /** Délka dráhy JEDNOHO průchodu (mm) - u vrtání se nepoužívá, viz `calculateDrillingFeature`. */
  cuttingLengthPerPassMm: number;
  /** Přídavek/úběr předaný `PassStrategy` - radiální pro většinu podtypů,
   *  axiální pro `facing` (viz `pass-strategy.ts` komentář). */
  stockToRemoveMm: number;
  radialStockMm: number;
  axialStockMm: number;
}

function planSubtypeLength(feature: TurningFeature): SubtypeLengthPlan {
  const g = feature.geometry;
  const radialStockMm = Math.abs(g.startDiameterMm - g.endDiameterMm) / 2;
  const axialStockMm = g.machiningLengthMm;

  switch (feature.subtype) {
    case "external_longitudinal":
    case "internal_longitudinal":
      return {
        cuttingLengthPerPassMm: g.machiningLengthMm + g.approachLengthMm + g.retractLengthMm,
        stockToRemoveMm: radialStockMm,
        radialStockMm,
        axialStockMm,
      };
    case "facing":
      // §6 "pro čelní soustružení navrhni a implementuj správný model podle
      // radiální dráhy" - dráha JEDNOHO průchodu je RADIÁLNÍ (od vnějšího k
      // vnitřnímu průměru), počet průchodů se odvozuje z AXIÁLNÍHO úběru
      // (kolik vrstev v ose Z je potřeba sejmout), ne z radiálního.
      return {
        cuttingLengthPerPassMm: radialStockMm + g.approachLengthMm + g.retractLengthMm,
        stockToRemoveMm: axialStockMm,
        radialStockMm,
        axialStockMm,
      };
    case "grooving":
    case "parting":
      return {
        cuttingLengthPerPassMm: radialStockMm + g.approachLengthMm + g.retractLengthMm,
        stockToRemoveMm: radialStockMm,
        radialStockMm,
        axialStockMm,
      };
    case "threading":
      return {
        cuttingLengthPerPassMm: g.machiningLengthMm + g.approachLengthMm + g.retractLengthMm,
        stockToRemoveMm: radialStockMm,
        radialStockMm,
        axialStockMm,
      };
    case "custom_path":
      return {
        cuttingLengthPerPassMm: g.customPathLengthMm ?? g.machiningLengthMm,
        stockToRemoveMm: radialStockMm,
        radialStockMm,
        axialStockMm,
      };
    case "drilling":
      // Vrtání nepoužívá PassStrategy - viz `calculateDrillingFeature`.
      return { cuttingLengthPerPassMm: 0, stockToRemoveMm: 0, radialStockMm: 0, axialStockMm };
  }
}

/**
 * `calculateFeatureCutting` (AP-MCE-001 Fáze C §5/§6) - ČISTÁ funkce, žádné
 * I/O. Spojuje efektivní průměr (§5), otáčky s omezením (§5), posuv/čas řezu
 * (§6) a počet průchodů (§4) do JEDNOHO výsledku pro daný `TurningFeature`.
 * Vrtání má vlastní, oddělenou implementaci (`calculateDrillingFeature`) -
 * nepoužívá `PassStrategy` stejným způsobem jako ostatní podtypy (peck cykly
 * mají jinou logiku než hrubovací/dokončovací průchody).
 */
export function calculateFeatureCutting(input: FeatureCuttingCalculationInput): FeatureCuttingResult {
  if (input.feature.subtype === "drilling") {
    return calculateDrillingFeature(input);
  }

  const { feature } = input;
  const plan = planSubtypeLength(feature);
  const explicitDiameter = feature.cuttingConditionOverride?.explicitDiameterOverrideMm;
  const { diameterMm: effectiveDiameterMm, source: spindleSpeedSource } = resolveEffectiveDiameterMm({
    subtype: feature.subtype,
    startDiameterMm: feature.geometry.startDiameterMm,
    endDiameterMm: feature.geometry.endDiameterMm,
    explicitDiameterOverrideMm: explicitDiameter,
  });

  const feedPerRevolutionMm =
    feature.subtype === "threading" && feature.geometry.threadPitchMm !== undefined && input.feedPerRevolutionMm <= 0
      ? feature.geometry.threadPitchMm
      : input.feedPerRevolutionMm;

  const spindle = resolveSpindleSpeed({
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    effectiveDiameterMm,
    explicitSpindleSpeedRpm: feature.cuttingConditionOverride?.spindleSpeedRpm,
    machineMinRpm: input.machineMinRpm,
    machineMaxRpm: input.machineMaxRpm,
    toolMaxCuttingSpeedMMin: input.toolMaxCuttingSpeedMMin,
  });

  const feedRateMmMin = spindle.rpm * feedPerRevolutionMm;
  const passes = resolvePassStrategy(plan.stockToRemoveMm, feature.machiningMode, feature.passStrategy ?? {});

  const warnings = [...spindle.warnings];
  if (passes.passCountManuallySpecified) {
    warnings.push(turningIssue("MANUAL_PASS_COUNT_USED", `Počet průchodů featuru "${feature.id}" byl zadán ručně.`));
  }
  if (passes.usedDefaultRoughingDepthOfCut) {
    warnings.push(
      turningIssue(
        "INVALID_DEPTH_OF_CUT",
        `Featuru "${feature.id}" chybí hloubka řezu pro hrubování - použita výchozí hodnota.`
      )
    );
  }

  const cuttingTimePerPassMin = feedRateMmMin > 0 ? plan.cuttingLengthPerPassMm / feedRateMmMin : 0;
  const dwellTimeMin = (feature.dwellTimeSec ?? 0) / 60;
  const totalCuttingTimeMin = cuttingTimePerPassMin * passes.totalPasses + dwellTimeMin;

  return {
    effectiveDiameterMm,
    spindleSpeedSource,
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    spindleSpeedRpm: spindle.rpm,
    feedPerRevolutionMm,
    feedRateMmMin,
    cuttingLengthMm: plan.cuttingLengthPerPassMm * passes.totalPasses,
    radialStockMm: plan.radialStockMm,
    axialStockMm: plan.axialStockMm,
    roughingPasses: passes.roughingPasses,
    finishingPasses: passes.finishingPasses,
    springPasses: passes.springPasses,
    totalPasses: passes.totalPasses,
    passCountManuallySpecified: passes.passCountManuallySpecified,
    usedDefaultRoughingDepthOfCut: passes.usedDefaultRoughingDepthOfCut,
    cuttingTimePerPassMin,
    totalCuttingTimeMin,
    dwellTimeMin,
    clampedToMachineLimit: spindle.clampedToMachineLimit,
    clampedToToolLimit: spindle.clampedToToolLimit,
    belowMachineMinimum: spindle.belowMachineMinimum,
    warnings,
  };
}

/**
 * Vrtání (AP-MCE-001 Fáze C §6 "pro vrtání: započítej hloubku vrtání, nájezd,
 * výjezd, případné vyjíždění třísky, počet peck cyklů, dwell, počet otvorů").
 * Efektivní průměr = průměr vrtáku (`geometry.startDiameterMm`, §5). Peck
 * drilling: každý peck kromě posledního přidává NAVÍC dráhu zpětného
 * vyjetí+opětovného zajetí na dno předchozího pecku (vyjíždění třísky) -
 * MVP model počítá tuhle vzdálenost jako `2 × peckDepthMm` za KAŽDÝ peck
 * kromě posledního, ne jako samostatnou rychloposuvovou dráhu (zjednodušení
 * rozsahu, zdokumentované u `TurningPowerEstimator`/§7 "zatím nemusí být
 * dokonale fyzikálně přesné").
 */
function calculateDrillingFeature(input: FeatureCuttingCalculationInput): FeatureCuttingResult {
  const { feature } = input;
  const g = feature.geometry;
  const holeCount = g.holeCount ?? 1;
  const depthMm = g.machiningLengthMm;

  const { diameterMm: effectiveDiameterMm, source: spindleSpeedSource } = resolveEffectiveDiameterMm({
    subtype: "drilling",
    startDiameterMm: g.startDiameterMm,
    endDiameterMm: g.endDiameterMm,
    explicitDiameterOverrideMm: feature.cuttingConditionOverride?.explicitDiameterOverrideMm,
  });

  const spindle = resolveSpindleSpeed({
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    effectiveDiameterMm,
    explicitSpindleSpeedRpm: feature.cuttingConditionOverride?.spindleSpeedRpm,
    machineMinRpm: input.machineMinRpm,
    machineMaxRpm: input.machineMaxRpm,
    toolMaxCuttingSpeedMMin: input.toolMaxCuttingSpeedMMin,
  });

  const feedPerRevolutionMm = input.feedPerRevolutionMm;
  const feedRateMmMin = spindle.rpm * feedPerRevolutionMm;

  const peckDepthMm = g.peckDepthMm;
  const peckCount = peckDepthMm && peckDepthMm > 0 ? Math.ceil(depthMm / peckDepthMm) : 1;
  const chipClearanceTravelMm = peckDepthMm && peckCount > 1 ? (peckCount - 1) * peckDepthMm * 2 : 0;
  const totalFeedTravelPerHoleMm = depthMm + g.approachLengthMm + chipClearanceTravelMm;
  const cuttingTimePerHoleMin = feedRateMmMin > 0 ? totalFeedTravelPerHoleMm / feedRateMmMin : 0;
  const dwellTimeMin = ((feature.dwellTimeSec ?? 0) * peckCount) / 60;
  const totalCuttingTimeMin = cuttingTimePerHoleMin * holeCount + dwellTimeMin;

  return {
    effectiveDiameterMm,
    spindleSpeedSource,
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    spindleSpeedRpm: spindle.rpm,
    feedPerRevolutionMm,
    feedRateMmMin,
    cuttingLengthMm: totalFeedTravelPerHoleMm * holeCount,
    radialStockMm: 0,
    axialStockMm: depthMm * holeCount,
    roughingPasses: peckCount * holeCount,
    finishingPasses: 0,
    springPasses: 0,
    totalPasses: peckCount * holeCount,
    passCountManuallySpecified: false,
    usedDefaultRoughingDepthOfCut: false,
    cuttingTimePerPassMin: cuttingTimePerHoleMin,
    totalCuttingTimeMin,
    dwellTimeMin,
    clampedToMachineLimit: spindle.clampedToMachineLimit,
    clampedToToolLimit: spindle.clampedToToolLimit,
    belowMachineMinimum: spindle.belowMachineMinimum,
    warnings: spindle.warnings,
  };
}
