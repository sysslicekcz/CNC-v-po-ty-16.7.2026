import { CalculationIssue } from "../entities/types";
import { calibrationIssue } from "./calibration-issue-codes";
import { CalibrationBacktestResult } from "./calibration-backtest-service";

export interface CalibrationSafetyThresholds {
  minimumSampleCount: number;
  minimumEffectiveSampleCount: number;
  /** Podíl 0..1 - maximální POVOLENÁ relativní změna koeficientu na jednu
   *  verzi (§18 "maximální změna koeficientu na jednu verzi"). */
  maxChangeFraction: number;
  minimumConfidence: number;
  /** Podíl 0..1 - jeden vzorek nesmí tvořit víc než tenhle podíl celkové
   *  `effectiveWeight` (§18 "ochrana proti jednomu dominantnímu vzorku"). */
  maxDominantSampleFraction: number;
  /** Podíl 0..1 - u `global`/`tenant` scope nesmí jeden stroj tvořit víc než
   *  tenhle podíl vzorků (§18 "ochrana proti jednomu dominantnímu stroji v
   *  globální kalibraci"). */
  maxDominantMachineFractionForGlobalScope: number;
}

export const DEFAULT_CALIBRATION_SAFETY_THRESHOLDS: CalibrationSafetyThresholds = {
  minimumSampleCount: 10,
  minimumEffectiveSampleCount: 5,
  maxChangeFraction: 0.3,
  minimumConfidence: 0.5,
  maxDominantSampleFraction: 0.4,
  maxDominantMachineFractionForGlobalScope: 0.5,
};

export interface CalibrationSafetyCheckInput {
  sampleCount: number;
  effectiveSampleCount: number;
  originalValue: number;
  proposedValue: number;
  confidence: number;
  isGlobalOrTenantScope: boolean;
  /** Podíl (0..1) `effectiveWeight`, který tvoří JEDEN nejtěžší vzorek. */
  dominantSampleWeightFraction: number;
  /** Podíl (0..1) vzorků pocházejících z JEDNOHO stroje. */
  dominantMachineFraction: number;
  mixesIncomparableOperations: boolean;
  usesUnapprovedActualTimes: boolean;
  /** `true`, pokud kalibrovaný cíl je `cuttingCoefficient`/`machineCoefficient`
   *  A datový soubor obsahuje nevysvětlený prostoj (§18 "ochrana proti
   *  zahrnutí prostoje do řezného koeficientu"). */
  includesUnexplainedDowntimeInCuttingCoefficient: boolean;
  crossTenantDataDetected: boolean;
  backtestResult?: CalibrationBacktestResult;
  thresholds?: CalibrationSafetyThresholds;
}

/**
 * `evaluateCalibrationSafetyRules` (AP-MCE-001 Fáze G §18) - ČISTÁ funkce,
 * jedenáct bezpečnostních pravidel ze zadání (dvanácté - "ochrana proti
 * retroaktivní změně starých výsledků" - je vynucené ARCHITEKTONICKY:
 * `CalculationResult` nemá settery a kalibrace se aplikuje jen na NOVÉ
 * výpočty přes `CalibrationProfileResolver`, viz architektonické testy §30,
 * ne runtime kontrola tady). Katalog `CalculationIssue` kódů (§26) nemá pro
 * KAŽDÉ z jedenácti pravidel unikátní kód - `minimumConfidence`/"dominantní
 * vzorek" vědomě sdílí `INSUFFICIENT_EFFECTIVE_SAMPLE_COUNT` (obojí ve
 * skutečnosti signalizuje "efektivní data nejsou dost různorodá/důvěryhodná
 * na kalibraci"), zdokumentováno u každého `push` níž.
 *
 * Při nesplnění VRACÍ blocking `CalculationIssue[]` (severity "error") - use
 * case (`GenerateCalibrationProposalUseCase`/`ApproveCalibrationProposalUseCase`)
 * musí návrh zamítnout, pokud pole není prázdné (§18 "Při nesplnění vrať
 * blocking validation error").
 */
export function evaluateCalibrationSafetyRules(input: CalibrationSafetyCheckInput): CalculationIssue[] {
  const thresholds = input.thresholds ?? DEFAULT_CALIBRATION_SAFETY_THRESHOLDS;
  const issues: CalculationIssue[] = [];

  if (input.sampleCount < thresholds.minimumSampleCount) {
    issues.push(calibrationIssue("INSUFFICIENT_SAMPLE_COUNT", `Počet vzorků (${input.sampleCount}) je pod minimem (${thresholds.minimumSampleCount}).`));
  }
  if (input.effectiveSampleCount < thresholds.minimumEffectiveSampleCount) {
    issues.push(calibrationIssue("INSUFFICIENT_EFFECTIVE_SAMPLE_COUNT", `Efektivní počet vzorků (${input.effectiveSampleCount}) je pod minimem (${thresholds.minimumEffectiveSampleCount}).`));
  }

  const changeFraction = input.originalValue !== 0 ? Math.abs(input.proposedValue - input.originalValue) / Math.abs(input.originalValue) : input.proposedValue !== 0 ? Number.POSITIVE_INFINITY : 0;
  if (changeFraction > thresholds.maxChangeFraction) {
    issues.push(
      calibrationIssue("CALIBRATION_CHANGE_TOO_LARGE", `Navrhovaná změna koeficientu (${(changeFraction * 100).toFixed(1)} %) přesahuje povolený limit (${(thresholds.maxChangeFraction * 100).toFixed(1)} %).`)
    );
  }

  if (input.confidence < thresholds.minimumConfidence) {
    issues.push(calibrationIssue("INSUFFICIENT_EFFECTIVE_SAMPLE_COUNT", `Confidence návrhu (${input.confidence.toFixed(2)}) je pod minimem (${thresholds.minimumConfidence}) - efektivní data nejsou dost důvěryhodná.`));
  }

  if (input.dominantSampleWeightFraction > thresholds.maxDominantSampleFraction) {
    issues.push(
      calibrationIssue(
        "INSUFFICIENT_EFFECTIVE_SAMPLE_COUNT",
        `Jeden vzorek tvoří ${(input.dominantSampleWeightFraction * 100).toFixed(0)} % efektivní váhy (limit ${(thresholds.maxDominantSampleFraction * 100).toFixed(0)} %) - kalibrace by byla řízená jedním vzorkem.`
      )
    );
  }

  if (input.isGlobalOrTenantScope && input.dominantMachineFraction > thresholds.maxDominantMachineFractionForGlobalScope) {
    issues.push(
      calibrationIssue(
        "CALIBRATION_SCOPE_CONFLICT",
        `Jeden stroj tvoří ${(input.dominantMachineFraction * 100).toFixed(0)} % vzorků globální/tenant kalibrace (limit ${(thresholds.maxDominantMachineFractionForGlobalScope * 100).toFixed(0)} %).`
      )
    );
  }

  if (input.mixesIncomparableOperations) {
    issues.push(calibrationIssue("CALIBRATION_SCOPE_CONFLICT", "Dataset směšuje nesrovnatelné operace (různé kategorie/podtypy bez společného rozsahu profilu)."));
  }

  if (input.usesUnapprovedActualTimes) {
    issues.push(calibrationIssue("ACTUAL_TIME_NOT_APPROVED", "Dataset obsahuje neschválené ActualTimeRecord záznamy."));
  }

  if (input.includesUnexplainedDowntimeInCuttingCoefficient) {
    issues.push(calibrationIssue("CALIBRATION_SAMPLE_INVALID", "Dataset pro řezný/strojní koeficient obsahuje nevysvětlený prostoj - prostoj se nesmí promítnout do řezného koeficientu."));
  }

  if (input.crossTenantDataDetected) {
    issues.push(calibrationIssue("CALIBRATION_SAMPLE_CROSS_TENANT", "Dataset obsahuje data mimo aktuálního tenanta."));
  }

  if (input.backtestResult && !input.backtestResult.passed) {
    issues.push(calibrationIssue("CALIBRATION_BACKTEST_FAILED", "Backtest návrh nepodpořil (zhoršení MAE, nebo zhoršení podskupiny)."));
  }

  return issues;
}
