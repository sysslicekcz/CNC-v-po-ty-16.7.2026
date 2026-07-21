import { GrindingPassStrategyInput } from "./grinding-pass-strategy-input";

export interface CylindricalPassStrategyResolution {
  roughingPasses: number;
  finishingPasses: number;
  sparkOutPasses: number;
  totalPasses: number;
  passCountManuallySpecified: boolean;
  usedDefaultRoughingInfeed: boolean;
  usedDefaultFinishingInfeed: boolean;
}

const FALLBACK_ROUGHING_INFEED_MM = 0.02;
const FALLBACK_FINISHING_INFEED_MM = 0.005;

/**
 * `resolveCylindricalPassStrategy` (AP-MCE-001 Fáze E §4) - ČISTÁ funkce,
 * žádné I/O. Na rozdíl od Fáze C `resolvePassStrategy` (kde `machiningMode`
 * rozhodoval MEZI hrubovacím a dokončovacím větvením) tady §4 dává JEDNU
 * kombinovanou formuli - `roughingPasses` a `finishingPasses` se počítají
 * SOUČASNĚ, ne jako vzájemně se vylučující alternativy (jeden brusný úsek
 * typicky obsahuje obojí, `machiningMode` featuru ovlivňuje jen koeficienty,
 * ne tenhle výpočet).
 */
export function resolveCylindricalPassStrategy(radialStockMm: number, input: GrindingPassStrategyInput): CylindricalPassStrategyResolution {
  const sparkOutPasses = input.sparkOutPasses ?? 0;

  if (input.passCount !== undefined) {
    return {
      roughingPasses: input.passCount,
      finishingPasses: 0,
      sparkOutPasses,
      totalPasses: input.passCount + sparkOutPasses,
      passCountManuallySpecified: true,
      usedDefaultRoughingInfeed: false,
      usedDefaultFinishingInfeed: false,
    };
  }

  const finishingAllowanceMm = Math.min(input.finishingAllowanceMm ?? 0, radialStockMm);
  const remainingForRoughing = Math.max(0, radialStockMm - finishingAllowanceMm);

  const usedDefaultRoughingInfeed = !input.roughingInfeedPerPassMm || input.roughingInfeedPerPassMm <= 0;
  const roughingInfeedPerPassMm = usedDefaultRoughingInfeed ? FALLBACK_ROUGHING_INFEED_MM : input.roughingInfeedPerPassMm!;
  const roughingPasses = remainingForRoughing === 0 ? 0 : Math.ceil(remainingForRoughing / roughingInfeedPerPassMm);

  const usedDefaultFinishingInfeed = !input.finishingInfeedPerPassMm || input.finishingInfeedPerPassMm <= 0;
  const finishingInfeedPerPassMm = usedDefaultFinishingInfeed ? FALLBACK_FINISHING_INFEED_MM : input.finishingInfeedPerPassMm!;
  const finishingPasses = finishingAllowanceMm === 0 ? 0 : Math.ceil(finishingAllowanceMm / finishingInfeedPerPassMm);

  return {
    roughingPasses,
    finishingPasses,
    sparkOutPasses,
    totalPasses: roughingPasses + finishingPasses + sparkOutPasses,
    passCountManuallySpecified: false,
    usedDefaultRoughingInfeed: roughingPasses > 0 && usedDefaultRoughingInfeed,
    usedDefaultFinishingInfeed: finishingPasses > 0 && usedDefaultFinishingInfeed,
  };
}

export interface SurfacePassStrategyResolution {
  depthLayers: number;
  crossPasses: number;
  strokesPerPass: number;
  totalTableStrokes: number;
  sparkOutPasses: number;
  passCountManuallySpecified: boolean;
  usedDefaultInfeed: boolean;
  usedDefaultCrossFeed: boolean;
}

const FALLBACK_SURFACE_INFEED_MM = 0.01;
const FALLBACK_CROSS_FEED_MM = 10;
const DEFAULT_STROKES_PER_PASS = 2;

/**
 * `resolveSurfacePassStrategy` (AP-MCE-001 Fáze E §4/§6) - stejná ČISTÁ
 * funkce, žádné I/O, pro rovinné broušení: `depthLayers = ceil(stockAllowance
 * Mm / infeedPerPassMm)`, `crossPasses = ceil(surfaceWidthMm /
 * effectiveCrossFeedMm)`, `totalTableStrokes = depthLayers × crossPasses ×
 * strokesPerPass` (§4 přesné formule).
 */
export function resolveSurfacePassStrategy(stockAllowanceMm: number, surfaceWidthMm: number, input: GrindingPassStrategyInput): SurfacePassStrategyResolution {
  const sparkOutPasses = input.sparkOutPasses ?? 0;
  const strokesPerPass = input.strokesPerPass ?? DEFAULT_STROKES_PER_PASS;

  const usedDefaultCrossFeed = !input.crossFeedMm || input.crossFeedMm <= 0;
  const effectiveCrossFeedMm = usedDefaultCrossFeed ? FALLBACK_CROSS_FEED_MM : input.crossFeedMm!;
  const crossPasses = Math.max(1, Math.ceil(surfaceWidthMm / effectiveCrossFeedMm));

  if (input.passCount !== undefined) {
    return {
      depthLayers: input.passCount,
      crossPasses,
      strokesPerPass,
      totalTableStrokes: input.passCount * crossPasses * strokesPerPass + sparkOutPasses,
      sparkOutPasses,
      passCountManuallySpecified: true,
      usedDefaultInfeed: false,
      usedDefaultCrossFeed,
    };
  }

  const usedDefaultInfeed = !input.infeedPerPassMm || input.infeedPerPassMm <= 0;
  const infeedPerPassMm = usedDefaultInfeed ? FALLBACK_SURFACE_INFEED_MM : input.infeedPerPassMm!;
  const depthLayers = stockAllowanceMm <= 0 ? 0 : Math.max(1, Math.ceil(stockAllowanceMm / infeedPerPassMm));

  return {
    depthLayers,
    crossPasses,
    strokesPerPass,
    totalTableStrokes: depthLayers * crossPasses * strokesPerPass + sparkOutPasses,
    sparkOutPasses,
    passCountManuallySpecified: false,
    usedDefaultInfeed: depthLayers > 0 && usedDefaultInfeed,
    usedDefaultCrossFeed,
  };
}
