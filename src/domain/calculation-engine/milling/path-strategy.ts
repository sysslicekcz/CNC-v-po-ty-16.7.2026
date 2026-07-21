import { CalculationIssue } from "../entities/types";
import { MillingFeature } from "./milling-feature";
import { millingIssue } from "./milling-issue-codes";

/** Odkud pochází efektivní délka dráhy (AP-MCE-001 Fáze D §4) - `"explicit"`
 *  = přímo zadaná `geometry.pathLengthMm`, zbytek je ODVOZENÝ (derivovaná
 *  dráha snižuje `confidenceScore`, viz `PATH_LENGTH_APPROXIMATED`). */
export type PathStrategyKind = "explicit" | "area" | "pocket" | "contour" | "slot" | "three_d_approximation" | "custom";

export interface PathStrategyResolution {
  effectivePathLengthMm: number;
  pathStrategy: PathStrategyKind;
  depthLayers: number;
  widthPasses: number;
  stepOverMm: number;
  stepDownMm: number;
  usedDefaultStepOver: boolean;
  usedDefaultStepDown: boolean;
  passCountManuallySpecified: boolean;
  /** `true` pokud dráha NENÍ explicitně zadaná (`geometry.pathLengthMm`) -
   *  §12 "odvozenou dráhu místo explicitní" confidence signál. */
  derivedPath: boolean;
  approximationType?: "three_d_surface";
  approximationReason?: string;
  warnings: CalculationIssue[];
}

/** §4 MVP výchozí boční krok, pokud `pathStrategy.stepOverMm` chybí -
 *  70 % průměru nástroje je běžná konzervativní hodnota pro hrubování i
 *  dokončování (zdokumentovaná konstanta, ne odvozená z katalogu nástroje). */
const DEFAULT_STEP_OVER_RATIO_OF_DIAMETER = 0.7;
/** §4 MVP výchozí hloubka jednoho hloubkového záběru, pokud `stepDownMm`
 *  chybí - stejná konvence jako Fáze C `FALLBACK_ROUGHING_DEPTH_OF_CUT_MM`. */
const FALLBACK_STEP_DOWN_MM = 1;
/** §4 "3D aproximace ... podle složitosti" - výchozí násobitel plochy/kroku,
 *  pokud `pathStrategy.complexityFactor` chybí (dráha po zvlněné ploše je VŽDY
 *  delší než prostý raster přes stejnou půdorysnou plochu). */
const DEFAULT_THREE_D_COMPLEXITY_FACTOR = 1.5;

interface ResolvedSteps {
  stepOverMm: number;
  usedDefaultStepOver: boolean;
  stepDownMm: number;
  usedDefaultStepDown: boolean;
}

function resolveSteps(feature: MillingFeature, toolDiameterMm: number | undefined): ResolvedSteps {
  const pathInput = feature.pathStrategy ?? {};
  const usedDefaultStepOver = pathInput.stepOverMm === undefined || pathInput.stepOverMm <= 0;
  const stepOverMm = !usedDefaultStepOver ? pathInput.stepOverMm! : (toolDiameterMm ?? 0) * DEFAULT_STEP_OVER_RATIO_OF_DIAMETER;
  const usedDefaultStepDown = pathInput.stepDownMm === undefined || pathInput.stepDownMm <= 0;
  const stepDownMm = !usedDefaultStepDown ? pathInput.stepDownMm! : FALLBACK_STEP_DOWN_MM;
  return { stepOverMm, usedDefaultStepOver, stepDownMm, usedDefaultStepDown };
}

function depthLayersFor(machiningDepthMm: number | undefined, stepDownMm: number): number {
  if (!machiningDepthMm || machiningDepthMm <= 0) return 1;
  return Math.max(1, Math.ceil(machiningDepthMm / stepDownMm));
}

/**
 * `resolveMillingPath` (AP-MCE-001 Fáze D §4) - ČISTÁ funkce, žádné I/O.
 * Spojuje explicitní/odvozenou délku dráhy s počtem hloubkových (`stepDown`)
 * a bočních (`stepOver`)/dokončovacích záběrů do JEDNOHO výsledku pro daný
 * `MillingFeature`. Vrtání/zahlubování/vystružování/závitování mají VLASTNÍ,
 * oddělenou implementaci (`milling-hole-cycle.ts`) - nejsou to dráhy odvozené
 * z plochy, ale cykly podle hloubky/počtu otvorů (§7).
 */
export function resolveMillingPath(feature: MillingFeature, toolDiameterMm: number | undefined): PathStrategyResolution {
  const g = feature.geometry;
  const passInput = feature.passStrategy ?? {};
  const { stepOverMm, usedDefaultStepOver, stepDownMm, usedDefaultStepDown } = resolveSteps(feature, toolDiameterMm);
  const warnings: CalculationIssue[] = [];
  const isRoughing = feature.machiningMode === "roughing";

  const explicitPathMm = g.pathLengthMm !== undefined && g.pathLengthMm > 0 ? g.pathLengthMm : undefined;

  const base = (() => {
    switch (feature.subtype) {
      case "face_milling": {
        const passCountAcrossWidth = stepOverMm > 0 ? Math.ceil((g.areaWidthMm ?? 0) / stepOverMm) : 0;
        const pathPerLayer = passCountAcrossWidth * ((g.areaLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm);
        const depthLayers = depthLayersFor(g.machiningDepthMm, stepDownMm);
        return { pathStrategy: "area" as const, effectivePathLengthMm: pathPerLayer * depthLayers, depthLayers, widthPasses: passCountAcrossWidth };
      }
      case "pocket_milling": {
        const depthLayers = depthLayersFor(g.pocketDepthMm, stepDownMm);
        if (isRoughing) {
          const widthPasses = stepOverMm > 0 ? Math.ceil((g.pocketWidthMm ?? 0) / stepOverMm) : 0;
          const pathPerLayer = widthPasses * ((g.pocketLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm);
          return { pathStrategy: "pocket" as const, effectivePathLengthMm: pathPerLayer * depthLayers, depthLayers, widthPasses };
        }
        const finishingPasses = Math.max(1, passInput.finishingPasses ?? 1);
        const perimeterMm = 2 * ((g.pocketLengthMm ?? 0) + (g.pocketWidthMm ?? 0));
        const pathPerPass = perimeterMm + g.approachLengthMm + g.retractLengthMm;
        return { pathStrategy: "pocket" as const, effectivePathLengthMm: pathPerPass * finishingPasses, depthLayers: 1, widthPasses: finishingPasses };
      }
      case "contour_milling": {
        const depthLayers = depthLayersFor(g.machiningDepthMm, stepDownMm);
        const widthPasses = passInput.passCount ?? Math.max(1, isRoughing ? 1 : passInput.finishingPasses ?? 1);
        const pathPerPass = (g.contourLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
        return { pathStrategy: "contour" as const, effectivePathLengthMm: pathPerPass * depthLayers * widthPasses, depthLayers, widthPasses };
      }
      case "slot_milling": {
        const depthLayers = depthLayersFor(g.machiningDepthMm, stepDownMm);
        const slotWidthMm = g.slotWidthMm ?? toolDiameterMm ?? 0;
        const widthPasses =
          toolDiameterMm && slotWidthMm > toolDiameterMm && stepOverMm > 0
            ? 1 + Math.ceil((slotWidthMm - toolDiameterMm) / stepOverMm)
            : 1;
        const pathPerPass = (g.slotLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
        return { pathStrategy: "slot" as const, effectivePathLengthMm: pathPerPass * widthPasses * depthLayers, depthLayers, widthPasses };
      }
      case "two_d": {
        const pathPerPass = explicitPathMm ?? (g.contourLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
        const widthPasses = passInput.passCount ?? 1;
        return { pathStrategy: (explicitPathMm ? "explicit" : "contour") as PathStrategyKind, effectivePathLengthMm: pathPerPass * widthPasses, depthLayers: 1, widthPasses };
      }
      case "two_and_half_d": {
        const pathPerLayer = explicitPathMm ?? (g.contourLengthMm ?? 0) + g.approachLengthMm + g.retractLengthMm;
        const depthLayers = depthLayersFor(g.machiningDepthMm, stepDownMm);
        const widthPasses = passInput.passCount ?? 1;
        return {
          pathStrategy: (explicitPathMm ? "explicit" : "contour") as PathStrategyKind,
          effectivePathLengthMm: pathPerLayer * depthLayers * widthPasses,
          depthLayers,
          widthPasses,
        };
      }
      case "three_d": {
        const complexityFactor = feature.pathStrategy?.complexityFactor ?? DEFAULT_THREE_D_COMPLEXITY_FACTOR;
        const depthLayers = depthLayersFor(g.machiningDepthMm, stepDownMm);
        if (explicitPathMm !== undefined) {
          return { pathStrategy: "three_d_approximation" as const, effectivePathLengthMm: explicitPathMm * depthLayers, depthLayers, widthPasses: 1 };
        }
        const areaMm2 = (g.areaLengthMm ?? g.pocketLengthMm ?? 0) * (g.areaWidthMm ?? g.pocketWidthMm ?? 0);
        const rasterLengthMm = stepOverMm > 0 ? (areaMm2 / stepOverMm) * complexityFactor : 0;
        const pathPerLayer = rasterLengthMm + g.approachLengthMm + g.retractLengthMm;
        return { pathStrategy: "three_d_approximation" as const, effectivePathLengthMm: pathPerLayer * depthLayers, depthLayers, widthPasses: 1 };
      }
      case "custom_path": {
        const repeats = passInput.passCount ?? 1;
        return { pathStrategy: "custom" as const, effectivePathLengthMm: (explicitPathMm ?? 0) * repeats, depthLayers: 1, widthPasses: repeats };
      }
      default:
        return { pathStrategy: "custom" as const, effectivePathLengthMm: 0, depthLayers: 1, widthPasses: 1 };
    }
  })();

  const derivedPath = base.pathStrategy !== "explicit" && !(feature.subtype === "custom_path" && explicitPathMm !== undefined);
  if (derivedPath) {
    warnings.push(millingIssue("PATH_LENGTH_APPROXIMATED", `Feature "${feature.id}": délka dráhy byla odvozena z geometrie, ne zadaná explicitně.`));
  }
  if (feature.subtype === "three_d") {
    warnings.push(
      millingIssue(
        "THREE_D_RESULT_APPROXIMATED",
        `Feature "${feature.id}": 3D obrábění používá zjednodušený MVP model (plocha/stepOver/stepDown/complexityFactor), nenahrazuje CAM simulaci.`
      )
    );
  }

  const passCountManuallySpecified =
    passInput.passCount !== undefined && (feature.subtype === "contour_milling" || feature.subtype === "two_d" || feature.subtype === "two_and_half_d" || feature.subtype === "custom_path");

  return {
    effectivePathLengthMm: base.effectivePathLengthMm,
    pathStrategy: base.pathStrategy,
    depthLayers: base.depthLayers,
    widthPasses: base.widthPasses,
    stepOverMm,
    stepDownMm,
    usedDefaultStepOver,
    usedDefaultStepDown,
    passCountManuallySpecified,
    derivedPath,
    approximationType: feature.subtype === "three_d" ? "three_d_surface" : undefined,
    approximationReason:
      feature.subtype === "three_d"
        ? "Zjednodušený MVP model (plocha × stepOver × stepDown × complexityFactor), nenahrazuje CAM simulaci povrchu."
        : undefined,
    warnings,
  };
}
