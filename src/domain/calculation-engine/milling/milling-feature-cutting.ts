import { CalculationIssue } from "../entities/types";
import { MillingFeature } from "./milling-feature";
import { resolveMillingPath, PathStrategyKind } from "./path-strategy";
import { resolveSpindleSpeed, resolveFeedRate } from "./spindle-feed-resolver";
import { millingIssue } from "./milling-issue-codes";

export interface FeatureCuttingCalculationInput {
  feature: MillingFeature;
  toolDiameterMm: number;
  teethCount: number;
  cuttingSpeedMMin: number;
  feedPerToothMm: number;
  machineMinRpm?: number;
  machineMaxRpm?: number;
  machineMaxFeedRateMmMin?: number;
  machineRapidTraverseRateMmMin?: number;
  toolMaxCuttingSpeedMMin?: number;
  toolMaxFeedPerToothMm?: number;
}

export type MillingPathKind = PathStrategyKind | "drilling_cycle";

export interface FeatureCuttingResult {
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
  totalPasses: number;
  rawCuttingTimeMin: number;
  rapidMoveTimeMin: number;
  plungeTimeMin: number;
  dwellTimeMin: number;
  /** Čištění třísek + prodleva chladicí kapaliny (§6 "chipEvacuationTime"/
   *  "coolantDelay") - MVP malá konstanta, skládá se do `auxiliaryTimeMin`
   *  na úrovni operace (stejný precedens jako Fáze C dwell). */
  auxiliaryContributionMin: number;
  passCountManuallySpecified: boolean;
  usedDefaultStepOver: boolean;
  usedDefaultStepDown: boolean;
  derivedPath: boolean;
  approximationType?: "three_d_surface";
  approximationReason?: string;
  clampedToMachineLimit: boolean;
  clampedToToolLimit: boolean;
  belowMachineMinimum: boolean;
  feedClampedToMachineLimit: boolean;
  feedClampedToToolLimit: boolean;
  warnings: CalculationIssue[];
}

/** §6 MVP konstanta - plunge (zápich v ose Z) je pomalejší než boční posuv
 *  stejným nástrojem (ne každý frézovací nástroj umí plynule vjíždět axiálně
 *  plnou rychlostí), 40 % boční rychlosti je konzervativní zdokumentovaný
 *  odhad. */
const PLUNGE_FEED_RATIO = 0.4;
/** §6 MVP výchozí rychloposuv, pokud `MachineProfile.rapidTraverseRateMmMin`
 *  chybí - konzervativní hodnota běžná pro menší obráběcí centra. */
const DEFAULT_RAPID_TRAVERSE_MM_MIN = 8000;
/** §6 "chipEvacuationTime" - MVP konstanta za KAŽDÝ hloubkový záběr u
 *  uzavřených útvarů (kapsa/drážka/otvor), kde se tříska hůř odvádí. */
const CHIP_EVACUATION_SEC_PER_LAYER = 2;
/** §6 "coolantDelay" - MVP konstanta, jednou za feature, pokud je zadaný
 *  `coolantMode` (najetí/prodleva chladicí kapaliny před řezem). */
const COOLANT_DELAY_SEC = 1;

const POOR_CHIP_EVACUATION_SUBTYPES = new Set(["pocket_milling", "slot_milling", "drilling", "countersinking", "reaming", "threading"]);

function auxiliaryContribution(feature: MillingFeature, depthLayersOrPasses: number): number {
  const chipEvacuationMin = POOR_CHIP_EVACUATION_SUBTYPES.has(feature.subtype) ? (depthLayersOrPasses * CHIP_EVACUATION_SEC_PER_LAYER) / 60 : 0;
  const coolantDelayMin = feature.coolantMode ? COOLANT_DELAY_SEC / 60 : 0;
  return chipEvacuationMin + coolantDelayMin;
}

const HOLE_FAMILY_SUBTYPES = new Set(["drilling", "countersinking", "reaming", "threading"]);

/**
 * `calculateFeatureCutting` (AP-MCE-001 Fáze D §5/§6) - ČISTÁ funkce, žádné
 * I/O. Spojuje otáčky/posuv s omezením (§5), efektivní dráhu (§4) a čas
 * řezu/rychloposuvu/zápichu (§6) do JEDNOHO výsledku pro daný `MillingFeature`.
 * Vrtání a otvorové operace (`drilling`/`countersinking`/`reaming`/`threading`)
 * mají VLASTNÍ, oddělenou implementaci (`calculateHoleCycleFeature`, §7) -
 * nejsou to dráhy odvozené z plochy, ale cykly podle hloubky/počtu otvorů.
 */
export function calculateFeatureCutting(input: FeatureCuttingCalculationInput): FeatureCuttingResult {
  if (HOLE_FAMILY_SUBTYPES.has(input.feature.subtype)) {
    return calculateHoleCycleFeature(input);
  }

  const { feature } = input;
  const spindle = resolveSpindleSpeed({
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    toolDiameterMm: input.toolDiameterMm,
    explicitSpindleSpeedRpm: feature.cuttingConditionOverride?.spindleSpeedRpm,
    machineMinRpm: input.machineMinRpm,
    machineMaxRpm: input.machineMaxRpm,
    toolMaxCuttingSpeedMMin: input.toolMaxCuttingSpeedMMin,
  });

  const feed = resolveFeedRate({
    feedPerToothMm: input.feedPerToothMm,
    teethCount: input.teethCount,
    spindleSpeedRpm: spindle.rpm,
    explicitFeedRateMmMin: feature.cuttingConditionOverride?.feedRateMmMin,
    machineMaxFeedRateMmMin: input.machineMaxFeedRateMmMin,
    toolMaxFeedPerToothMm: input.toolMaxFeedPerToothMm,
  });

  const path = resolveMillingPath(feature, input.toolDiameterMm);
  const rapidTraverseRateMmMin = input.machineRapidTraverseRateMmMin ?? DEFAULT_RAPID_TRAVERSE_MM_MIN;

  const rawCuttingTimeMin = feed.feedRateMmMin > 0 ? path.effectivePathLengthMm / feed.feedRateMmMin : 0;

  const plungeFeedRateMmMin = feed.feedRateMmMin * PLUNGE_FEED_RATIO;
  const plungeDistanceMm = path.depthLayers * path.stepDownMm;
  const plungeTimeMin = plungeFeedRateMmMin > 0 ? plungeDistanceMm / plungeFeedRateMmMin : 0;

  const repositions = Math.max(0, path.depthLayers - 1) + Math.max(0, path.widthPasses - 1);
  const repositionDistanceMm = feature.geometry.approachLengthMm + feature.geometry.retractLengthMm;
  const rapidMoveTimeMin = rapidTraverseRateMmMin > 0 ? (repositions * repositionDistanceMm) / rapidTraverseRateMmMin : 0;

  const dwellTimeMin = (feature.dwellTimeSec ?? 0) / 60;
  const totalPasses = path.depthLayers * path.widthPasses;

  return {
    toolDiameterMm: input.toolDiameterMm,
    teethCount: input.teethCount,
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    spindleSpeedRpm: spindle.rpm,
    spindleSpeedSource: feature.cuttingConditionOverride?.spindleSpeedRpm !== undefined ? "explicit" : "derived",
    feedPerToothMm: input.feedPerToothMm,
    feedRateMmMin: feed.feedRateMmMin,
    feedSource: feature.cuttingConditionOverride?.feedRateMmMin !== undefined ? "explicit" : "derived",
    effectivePathLengthMm: path.effectivePathLengthMm,
    pathStrategy: path.pathStrategy,
    depthLayers: path.depthLayers,
    widthPasses: path.widthPasses,
    stepOverMm: path.stepOverMm,
    stepDownMm: path.stepDownMm,
    totalPasses,
    rawCuttingTimeMin,
    rapidMoveTimeMin,
    plungeTimeMin,
    dwellTimeMin,
    auxiliaryContributionMin: auxiliaryContribution(feature, path.depthLayers),
    passCountManuallySpecified: path.passCountManuallySpecified,
    usedDefaultStepOver: path.usedDefaultStepOver,
    usedDefaultStepDown: path.usedDefaultStepDown,
    derivedPath: path.derivedPath,
    approximationType: path.approximationType,
    approximationReason: path.approximationReason,
    clampedToMachineLimit: spindle.clampedToMachineLimit,
    clampedToToolLimit: spindle.clampedToToolLimit,
    belowMachineMinimum: spindle.belowMachineMinimum,
    feedClampedToMachineLimit: feed.clampedToMachineLimit,
    feedClampedToToolLimit: feed.clampedToToolLimit,
    warnings: [...spindle.warnings, ...feed.warnings, ...path.warnings],
  };
}

/**
 * Vrtání a otvorové operace (AP-MCE-001 Fáze D §7) - efektivní průměr je
 * průměr nástroje (§5, stejně jako u ostatních subtypů). Peck cykly: MVP
 * model počítá vyjíždění třísky jako `2 × peckDepthMm` za KAŽDÝ peck kromě
 * posledního (stejné zjednodušení jako Fáze C `calculateDrillingFeature`).
 * `threading` (řezání závitu) používá `threadPitchMm` jako axiální posuv na
 * otáčku a §7 "reverzaci" modeluje jako DVOJNÁSOBEK dráhy (najetí na
 * hloubku + řízená reverzace zpět stejnou rychlostí, ne rychloposuvem jako
 * u vrtání).
 */
function calculateHoleCycleFeature(input: FeatureCuttingCalculationInput): FeatureCuttingResult {
  const { feature } = input;
  const g = feature.geometry;
  const holeCount = g.holeCount ?? 1;
  const depthMm = g.machiningDepthMm ?? 0;

  const spindle = resolveSpindleSpeed({
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    toolDiameterMm: input.toolDiameterMm,
    explicitSpindleSpeedRpm: feature.cuttingConditionOverride?.spindleSpeedRpm,
    machineMinRpm: input.machineMinRpm,
    machineMaxRpm: input.machineMaxRpm,
    toolMaxCuttingSpeedMMin: input.toolMaxCuttingSpeedMMin,
  });

  const isThreading = feature.subtype === "threading";
  const feed = resolveFeedRate({
    feedPerToothMm: isThreading && g.threadPitchMm !== undefined ? g.threadPitchMm : input.feedPerToothMm,
    teethCount: isThreading ? 1 : input.teethCount,
    spindleSpeedRpm: spindle.rpm,
    explicitFeedRateMmMin: feature.cuttingConditionOverride?.feedRateMmMin,
    machineMaxFeedRateMmMin: isThreading ? undefined : input.machineMaxFeedRateMmMin,
    toolMaxFeedPerToothMm: isThreading ? undefined : input.toolMaxFeedPerToothMm,
  });

  const warnings = [...spindle.warnings, ...feed.warnings];
  if (isThreading && (!g.threadPitchMm || g.threadPitchMm <= 0)) {
    warnings.push(millingIssue("INVALID_THREAD_PITCH", `Feature "${feature.id}": závit vyžaduje kladné 'threadPitchMm'.`, "threadPitchMm"));
  }

  const peckDepthMm = g.peckDepthMm;
  const peckCount = peckDepthMm && peckDepthMm > 0 ? Math.ceil(depthMm / peckDepthMm) : 1;
  const chipClearanceTravelMm = peckDepthMm && peckCount > 1 ? (peckCount - 1) * peckDepthMm * 2 : 0;

  const totalFeedTravelPerHoleMm = isThreading
    ? 2 * (depthMm + g.approachLengthMm)
    : depthMm + g.approachLengthMm + chipClearanceTravelMm;
  const cuttingTimePerHoleMin = feed.feedRateMmMin > 0 ? totalFeedTravelPerHoleMm / feed.feedRateMmMin : 0;
  const rawCuttingTimeMin = cuttingTimePerHoleMin * holeCount;

  const rapidTraverseRateMmMin = input.machineRapidTraverseRateMmMin ?? DEFAULT_RAPID_TRAVERSE_MM_MIN;
  // §7 "návrat do bezpečné výšky" (retrakce po každém otvoru) + "poziční
  // přejezdy mezi otvory" (rychloposuv mezi otvory, `holeCount - 1` přejezdů,
  // vzdálenost aproximovaná `retractLengthMm` - zdokumentovaná MVP náhrada
  // za neexistující XY souřadnice otvorů, viz `path-strategy.ts` komentář o
  // opakovaném použití geometrie pro rychloposuvové odhady).
  const rapidMoveTimeMin =
    rapidTraverseRateMmMin > 0 ? (holeCount * g.retractLengthMm + Math.max(0, holeCount - 1) * g.approachLengthMm) / rapidTraverseRateMmMin : 0;

  const dwellTimeMin = ((feature.dwellTimeSec ?? 0) * peckCount * holeCount) / 60;

  return {
    toolDiameterMm: input.toolDiameterMm,
    teethCount: input.teethCount,
    cuttingSpeedMMin: input.cuttingSpeedMMin,
    spindleSpeedRpm: spindle.rpm,
    spindleSpeedSource: feature.cuttingConditionOverride?.spindleSpeedRpm !== undefined ? "explicit" : "derived",
    feedPerToothMm: feed.feedRateMmMin > 0 && spindle.rpm > 0 ? feed.feedRateMmMin / spindle.rpm : 0,
    feedRateMmMin: feed.feedRateMmMin,
    feedSource: feature.cuttingConditionOverride?.feedRateMmMin !== undefined ? "explicit" : "derived",
    effectivePathLengthMm: totalFeedTravelPerHoleMm * holeCount,
    pathStrategy: "drilling_cycle",
    depthLayers: peckCount,
    widthPasses: holeCount,
    stepOverMm: 0,
    stepDownMm: peckDepthMm ?? depthMm,
    totalPasses: peckCount * holeCount,
    rawCuttingTimeMin,
    rapidMoveTimeMin,
    plungeTimeMin: 0,
    dwellTimeMin,
    auxiliaryContributionMin: auxiliaryContribution(feature, peckCount * holeCount),
    passCountManuallySpecified: false,
    usedDefaultStepOver: false,
    usedDefaultStepDown: false,
    derivedPath: false,
    clampedToMachineLimit: spindle.clampedToMachineLimit,
    clampedToToolLimit: spindle.clampedToToolLimit,
    belowMachineMinimum: spindle.belowMachineMinimum,
    feedClampedToMachineLimit: feed.clampedToMachineLimit,
    feedClampedToToolLimit: feed.clampedToToolLimit,
    warnings,
  };
}
