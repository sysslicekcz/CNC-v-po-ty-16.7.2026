import { ValidationError } from "@/domain/errors/validation-error";
import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { CalibrationSample } from "./calibration-sample";
import { CalibrationCoefficientTargetName } from "./coefficient-target";
import { median } from "./calibration-outlier-detector";

export type BacktestSplitMethod = "time_period" | "sample_id_hash" | "explicit_period";

export interface BacktestSplitInput {
  samples: readonly CalibrationSample[];
  method: BacktestSplitMethod;
  trainingRatio?: number;
  explicitValidationPeriod?: { from: string; to: string };
}

export interface BacktestSplitResult {
  trainingSamples: readonly CalibrationSample[];
  validationSamples: readonly CalibrationSample[];
}

/** Stabilní (deterministický) hash řetězce pro `"sample_id_hash"` dělení
 *  (§17 "stabilní hash sample ID") - stejný vstup vždy dá stejný výstup,
 *  žádná závislost na pořadí iterace/`Math.random()`. */
function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * `splitSamplesForBacktest` (AP-MCE-001 Fáze G §17) - ČISTÁ, deterministická
 * funkce, tři podporované metody dělení PŘESNĚ podle zadání.
 */
export function splitSamplesForBacktest(input: BacktestSplitInput): BacktestSplitResult {
  const ratio = input.trainingRatio ?? 0.7;

  switch (input.method) {
    case "time_period": {
      const sorted = [...input.samples].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const splitIndex = Math.floor(sorted.length * ratio);
      return { trainingSamples: sorted.slice(0, splitIndex), validationSamples: sorted.slice(splitIndex) };
    }
    case "sample_id_hash": {
      const training: CalibrationSample[] = [];
      const validation: CalibrationSample[] = [];
      for (const sample of input.samples) {
        const bucket = (stableHash(sample.id) % 100) / 100;
        (bucket < ratio ? training : validation).push(sample);
      }
      return { trainingSamples: training, validationSamples: validation };
    }
    case "explicit_period": {
      if (!input.explicitValidationPeriod) {
        throw new ValidationError("splitSamplesForBacktest: 'explicitValidationPeriod' je povinné pro metodu 'explicit_period'.");
      }
      const { from, to } = input.explicitValidationPeriod;
      const validation = input.samples.filter((s) => s.createdAt >= from && s.createdAt <= to);
      const training = input.samples.filter((s) => !(s.createdAt >= from && s.createdAt <= to));
      return { trainingSamples: training, validationSamples: validation };
    }
    default: {
      const exhaustive: never = input.method;
      throw new ValidationError(`splitSamplesForBacktest: neznámá metoda "${exhaustive}".`);
    }
  }
}

export interface SubgroupStability {
  groupKey: string;
  sampleCount: number;
  maeBeforeMin: number;
  maeAfterMin: number;
  worsenedSignificantly: boolean;
}

export interface CalibrationBacktestInput {
  targetName: CalibrationCoefficientTargetName;
  originalValue: number;
  proposedValue: number;
  validationSamples: readonly CalibrationSample[];
}

export interface CalibrationBacktestResult {
  targetName: CalibrationCoefficientTargetName;
  validationSampleCount: number;
  maeBeforeMin: number;
  maeAfterMin: number;
  medianAbsolutePercentageErrorBefore: number;
  medianAbsolutePercentageErrorAfter: number;
  biasBeforeMin: number;
  biasAfterMin: number;
  improvedSampleCount: number;
  worsenedSampleCount: number;
  worstRegressionMin: number;
  stabilityByMachine: SubgroupStability[];
  stabilityByMaterial: SubgroupStability[];
  stabilityByOperationCategory: SubgroupStability[];
  /** `true` jen pokud se MAE zlepší A ŽÁDNÁ podskupina se výrazně
   *  nezhorší (§17 "nesmí být schválena automaticky jen proto, že zlepší
   *  průměr ... musí kontrolovat, zda výrazně nezhorší určitou podskupinu"). */
  passed: boolean;
  warnings: CalculationIssue[];
}

const SUBGROUP_WORSENING_THRESHOLD = 0.2;
const MIN_SUBGROUP_SIZE_FOR_STABILITY_CHECK = 3;

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function computeSubgroupStability(samples: readonly CalibrationSample[], adjustedPredicted: ReadonlyMap<string, number>, keyOf: (s: CalibrationSample) => string | undefined): SubgroupStability[] {
  const groups = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    const key = keyOf(sample);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(sample);
    groups.set(key, bucket);
  }

  const result: SubgroupStability[] = [];
  for (const [groupKey, groupSamples] of groups) {
    if (groupSamples.length < MIN_SUBGROUP_SIZE_FOR_STABILITY_CHECK) continue;
    const maeBeforeMin = mean(groupSamples.map((s) => Math.abs(s.actualTimeMin - s.predictedTimeMin)));
    const maeAfterMin = mean(groupSamples.map((s) => Math.abs(s.actualTimeMin - (adjustedPredicted.get(s.id) ?? s.predictedTimeMin))));
    const worsenedSignificantly = maeBeforeMin > 0 && (maeAfterMin - maeBeforeMin) / maeBeforeMin > SUBGROUP_WORSENING_THRESHOLD;
    result.push({ groupKey, sampleCount: groupSamples.length, maeBeforeMin, maeAfterMin, worsenedSignificantly });
  }
  return result;
}

/**
 * `CalibrationBacktestService` (AP-MCE-001 Fáze G §17) - ČISTÁ funkce nad
 * VALIDAČNÍ množinou (§17 "training set" / "validation set" split už udělal
 * volající přes `splitSamplesForBacktest`). MVP zjednodušení: "predikce po
 * kalibraci" se simuluje jako `predictedTimeMin × (proposedValue /
 * originalValue)` - stejný lineární předpoklad, který používá i
 * `CalibrationMethod` při odvozování `proposedValue` (§15), ne úplné
 * přepočítání přes `CalculationStrategy` (to by vyžadovalo znovu-sestavit
 * celý `CalculationContext` pro každý historický vzorek, mimo rozsah MVP -
 * zdokumentovaná mez, viz finální souhrn Fáze G).
 */
export function runCalibrationBacktest(input: CalibrationBacktestInput): CalibrationBacktestResult {
  const warnings: CalculationIssue[] = [];
  const samples = input.validationSamples;

  if (samples.length === 0) {
    warnings.push(calibrationIssue("CALIBRATION_BACKTEST_FAILED", "Validační množina je prázdná - backtest nelze provést."));
    return {
      targetName: input.targetName,
      validationSampleCount: 0,
      maeBeforeMin: 0,
      maeAfterMin: 0,
      medianAbsolutePercentageErrorBefore: 0,
      medianAbsolutePercentageErrorAfter: 0,
      biasBeforeMin: 0,
      biasAfterMin: 0,
      improvedSampleCount: 0,
      worsenedSampleCount: 0,
      worstRegressionMin: 0,
      stabilityByMachine: [],
      stabilityByMaterial: [],
      stabilityByOperationCategory: [],
      passed: false,
      warnings,
    };
  }

  const ratio = input.originalValue !== 0 ? input.proposedValue / input.originalValue : 1;
  const adjustedPredicted = new Map(samples.map((s) => [s.id, s.predictedTimeMin * ratio] as const));

  const errorsBefore = samples.map((s) => Math.abs(s.actualTimeMin - s.predictedTimeMin));
  const errorsAfter = samples.map((s) => Math.abs(s.actualTimeMin - (adjustedPredicted.get(s.id) ?? s.predictedTimeMin)));

  const percentErrorsBefore = samples.map((s) => (s.actualTimeMin > 0 ? (Math.abs(s.actualTimeMin - s.predictedTimeMin) / s.actualTimeMin) * 100 : 0)).sort((a, b) => a - b);
  const percentErrorsAfter = samples
    .map((s) => (s.actualTimeMin > 0 ? (Math.abs(s.actualTimeMin - (adjustedPredicted.get(s.id) ?? s.predictedTimeMin)) / s.actualTimeMin) * 100 : 0))
    .sort((a, b) => a - b);

  let improvedSampleCount = 0;
  let worsenedSampleCount = 0;
  let worstRegressionMin = 0;
  samples.forEach((_s, i) => {
    if (errorsAfter[i] < errorsBefore[i]) improvedSampleCount++;
    else if (errorsAfter[i] > errorsBefore[i]) {
      worsenedSampleCount++;
      worstRegressionMin = Math.max(worstRegressionMin, errorsAfter[i] - errorsBefore[i]);
    }
  });

  const stabilityByMachine = computeSubgroupStability(samples, adjustedPredicted, (s) => s.machineProfileId);
  const stabilityByMaterial = computeSubgroupStability(samples, adjustedPredicted, (s) => s.materialProfileId);
  const stabilityByOperationCategory = computeSubgroupStability(samples, adjustedPredicted, (s) => s.operationCategory);
  const anySubgroupWorsened = [...stabilityByMachine, ...stabilityByMaterial, ...stabilityByOperationCategory].some((g) => g.worsenedSignificantly);

  const maeBeforeMin = mean(errorsBefore);
  const maeAfterMin = mean(errorsAfter);
  const passed = maeAfterMin <= maeBeforeMin && !anySubgroupWorsened;

  if (anySubgroupWorsened) {
    warnings.push(calibrationIssue("CALIBRATION_VALIDATION_SET_WORSENED", "Aspoň jedna podskupina (stroj/materiál/kategorie operace) by se kalibrací výrazně zhoršila."));
  }
  if (!passed && !anySubgroupWorsened) {
    warnings.push(calibrationIssue("CALIBRATION_BACKTEST_FAILED", "Backtest neprokázal zlepšení průměrné chyby (MAE) na validační množině."));
  }

  return {
    targetName: input.targetName,
    validationSampleCount: samples.length,
    maeBeforeMin,
    maeAfterMin,
    medianAbsolutePercentageErrorBefore: median(percentErrorsBefore),
    medianAbsolutePercentageErrorAfter: median(percentErrorsAfter),
    biasBeforeMin: mean(samples.map((s) => s.predictedTimeMin - s.actualTimeMin)),
    biasAfterMin: mean(samples.map((s) => (adjustedPredicted.get(s.id) ?? s.predictedTimeMin) - s.actualTimeMin)),
    improvedSampleCount,
    worsenedSampleCount,
    worstRegressionMin,
    stabilityByMachine,
    stabilityByMaterial,
    stabilityByOperationCategory,
    passed,
    warnings,
  };
}
