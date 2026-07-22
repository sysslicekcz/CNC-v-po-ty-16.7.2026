import { ValidationError } from "@/domain/errors/validation-error";
import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { CalibrationSample } from "./calibration-sample";
import { CoefficientTarget, CalibrationCoefficientTargetName, validateCoefficientTargetRange } from "./coefficient-target";
import { median } from "./calibration-outlier-detector";

export interface CalibrationMethodInput {
  targetName: CalibrationCoefficientTargetName;
  originalValue: number;
  minimumAllowed: number;
  maximumAllowed: number;
  /** POUZE vzorky, které už prošly `evaluateCalibrationSampleEligibility()`
   *  (§11) A nebyly vyloučené jako outlier (§12) - metoda sama žádnou
   *  filtraci neprovádí, dostane už čistý dataset (stejný "pure Domain nad
   *  hotovými kandidáty" vzor jako zbytek modulu). */
  samples: readonly CalibrationSample[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Poměr skutečnost/predikce JEDNOHO vzorku - násobek, o který by se
 *  MUSEL vynásobit `originalValue`, aby predikce přesně odpovídala
 *  skutečnosti (za předpokladu, že tenhle koeficient je jediná odchylka). */
function impliedRatios(samples: readonly CalibrationSample[]): number[] {
  return samples.filter((s) => s.predictedTimeMin > 0).map((s) => s.actualTimeMin / s.predictedTimeMin);
}

function buildWarnings(sampleCount: number): CalculationIssue[] {
  return sampleCount === 0 ? [calibrationIssue("INSUFFICIENT_SAMPLE_COUNT", "Žádný použitelný vzorek (predictedTimeMin > 0) pro tenhle kalibrační cíl.")] : [];
}

/**
 * `CalibrationMethod` (AP-MCE-001 Fáze G §15) - společné rozhraní tří MVP
 * implementací. Výpočet MUSÍ být deterministický/vysvětlitelný/verzovaný/
 * reprodukovatelný (§15) - žádná metoda tady nepoužívá náhodu ani
 * nekontrolovaný ML model.
 */
export interface CalibrationMethod {
  readonly methodName: string;
  readonly methodVersion: string;
  compute(input: CalibrationMethodInput): CoefficientTarget;
}

/** §15 "Weighted mean musí používat sampleWeight a confidence." */
export class WeightedMeanCalibrationMethod implements CalibrationMethod {
  readonly methodName = "weighted_mean";
  readonly methodVersion = "weighted-mean-1.0.0";

  compute(input: CalibrationMethodInput): CoefficientTarget {
    const usable = input.samples.filter((s) => s.predictedTimeMin > 0);
    const weighted = usable.map((s) => ({ ratio: s.actualTimeMin / s.predictedTimeMin, weight: s.sampleWeight * s.confidenceScore }));
    const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
    const weightedRatio = totalWeight > 0 ? weighted.reduce((sum, w) => sum + w.ratio * w.weight, 0) / totalWeight : 1;

    const target: CoefficientTarget = {
      name: input.targetName,
      originalValue: input.originalValue,
      proposedValue: clamp(input.originalValue * weightedRatio, input.minimumAllowed, input.maximumAllowed),
      minimumAllowed: input.minimumAllowed,
      maximumAllowed: input.maximumAllowed,
      sampleCount: usable.length,
      effectiveWeight: totalWeight,
      confidence: usable.length > 0 ? Math.min(1, totalWeight / usable.length) : 0,
      warnings: buildWarnings(usable.length),
    };
    return { ...target, warnings: [...target.warnings, ...validateCoefficientTargetRange(target)] };
  }
}

/** §15 "Median musí být odolná proti extrémům." */
export class MedianCalibrationMethod implements CalibrationMethod {
  readonly methodName = "median";
  readonly methodVersion = "median-1.0.0";

  compute(input: CalibrationMethodInput): CoefficientTarget {
    const ratios = impliedRatios(input.samples).sort((a, b) => a - b);
    const med = ratios.length > 0 ? median(ratios) : 1;
    const avgConfidence = input.samples.length > 0 ? input.samples.reduce((sum, s) => sum + s.confidenceScore, 0) / input.samples.length : 0;

    const target: CoefficientTarget = {
      name: input.targetName,
      originalValue: input.originalValue,
      proposedValue: clamp(input.originalValue * med, input.minimumAllowed, input.maximumAllowed),
      minimumAllowed: input.minimumAllowed,
      maximumAllowed: input.maximumAllowed,
      sampleCount: ratios.length,
      effectiveWeight: ratios.length,
      confidence: avgConfidence,
      warnings: buildWarnings(ratios.length),
    };
    return { ...target, warnings: [...target.warnings, ...validateCoefficientTargetRange(target)] };
  }
}

/** §15 "Trimmed mean musí mít konfigurovatelné ořezání." - `trimFraction`
 *  0.1 = ořízne 10 % nejnižších a 10 % nejvyšších poměrů před průměrováním. */
export class TrimmedMeanCalibrationMethod implements CalibrationMethod {
  readonly methodName = "trimmed_mean";
  readonly methodVersion = "trimmed-mean-1.0.0";

  constructor(private readonly trimFraction: number = 0.1) {
    if (!Number.isFinite(trimFraction) || trimFraction < 0 || trimFraction >= 0.5) {
      throw new ValidationError(`TrimmedMeanCalibrationMethod: 'trimFraction' musí být v rozsahu [0, 0.5), dostal jsem "${trimFraction}".`);
    }
  }

  compute(input: CalibrationMethodInput): CoefficientTarget {
    const ratios = impliedRatios(input.samples).sort((a, b) => a - b);
    const trimCount = Math.floor(ratios.length * this.trimFraction);
    const trimmed = ratios.slice(trimCount, ratios.length - trimCount);
    const mean = trimmed.length > 0 ? trimmed.reduce((sum, r) => sum + r, 0) / trimmed.length : 1;

    const target: CoefficientTarget = {
      name: input.targetName,
      originalValue: input.originalValue,
      proposedValue: clamp(input.originalValue * mean, input.minimumAllowed, input.maximumAllowed),
      minimumAllowed: input.minimumAllowed,
      maximumAllowed: input.maximumAllowed,
      sampleCount: ratios.length,
      effectiveWeight: trimmed.length,
      confidence: ratios.length > 0 ? trimmed.length / ratios.length : 0,
      warnings: buildWarnings(ratios.length),
    };
    return { ...target, warnings: [...target.warnings, ...validateCoefficientTargetRange(target)] };
  }
}
