import { describe, it, expect } from "vitest";
import { evaluateCalibrationSafetyRules, CalibrationSafetyCheckInput } from "./calibration-safety-rules";

/**
 * Unit testy pro `CalibrationSafetyRules` (AP-MCE-001 Fáze G §18, součást
 * 60 scénářů §28).
 */

function input(overrides: Partial<CalibrationSafetyCheckInput> = {}): CalibrationSafetyCheckInput {
  return {
    sampleCount: 20,
    effectiveSampleCount: 10,
    originalValue: 1,
    proposedValue: 1.1,
    confidence: 0.8,
    isGlobalOrTenantScope: false,
    dominantSampleWeightFraction: 0.1,
    dominantMachineFraction: 0.1,
    mixesIncomparableOperations: false,
    usesUnapprovedActualTimes: false,
    includesUnexplainedDowntimeInCuttingCoefficient: false,
    crossTenantDataDetected: false,
    ...overrides,
  };
}

describe("evaluateCalibrationSafetyRules (AP-MCE-001 Fáze G §18)", () => {
  it("1. bezpečný vstup neprodukuje žádné blokující issues", () => {
    expect(evaluateCalibrationSafetyRules(input())).toEqual([]);
  });

  it("2. sampleCount pod minimem vrátí INSUFFICIENT_SAMPLE_COUNT", () => {
    const issues = evaluateCalibrationSafetyRules(input({ sampleCount: 3 }));
    expect(issues.some((i) => i.code === "INSUFFICIENT_SAMPLE_COUNT")).toBe(true);
  });

  it("3. změna koeficientu nad limit (30 %) vrátí CALIBRATION_CHANGE_TOO_LARGE", () => {
    const issues = evaluateCalibrationSafetyRules(input({ originalValue: 1, proposedValue: 1.5 }));
    expect(issues.some((i) => i.code === "CALIBRATION_CHANGE_TOO_LARGE")).toBe(true);
  });

  it("4. dominantní stroj v globálním/tenant rozsahu vrátí CALIBRATION_SCOPE_CONFLICT", () => {
    const issues = evaluateCalibrationSafetyRules(input({ isGlobalOrTenantScope: true, dominantMachineFraction: 0.9 }));
    expect(issues.some((i) => i.code === "CALIBRATION_SCOPE_CONFLICT")).toBe(true);
  });

  it("5. stejná dominance stroje MIMO globální/tenant rozsah NEVYVOLÁ chybu", () => {
    const issues = evaluateCalibrationSafetyRules(input({ isGlobalOrTenantScope: false, dominantMachineFraction: 0.9 }));
    expect(issues.some((i) => i.code === "CALIBRATION_SCOPE_CONFLICT")).toBe(false);
  });

  it("6. neschválené ActualTimeRecord v datasetu vrátí ACTUAL_TIME_NOT_APPROVED", () => {
    const issues = evaluateCalibrationSafetyRules(input({ usesUnapprovedActualTimes: true }));
    expect(issues.some((i) => i.code === "ACTUAL_TIME_NOT_APPROVED")).toBe(true);
  });

  it("7. neúspěšný backtest v poskytnutém výsledku vrátí CALIBRATION_BACKTEST_FAILED", () => {
    const issues = evaluateCalibrationSafetyRules(
      input({
        backtestResult: {
          targetName: "cuttingCoefficient",
          validationSampleCount: 5,
          maeBeforeMin: 10,
          maeAfterMin: 20,
          medianAbsolutePercentageErrorBefore: 5,
          medianAbsolutePercentageErrorAfter: 10,
          biasBeforeMin: 0,
          biasAfterMin: 0,
          improvedSampleCount: 0,
          worsenedSampleCount: 5,
          worstRegressionMin: 10,
          stabilityByMachine: [],
          stabilityByMaterial: [],
          stabilityByOperationCategory: [],
          passed: false,
          warnings: [],
        },
      })
    );
    expect(issues.some((i) => i.code === "CALIBRATION_BACKTEST_FAILED")).toBe(true);
  });

  it("8. cross-tenant data vrátí CALIBRATION_SAMPLE_CROSS_TENANT", () => {
    const issues = evaluateCalibrationSafetyRules(input({ crossTenantDataDetected: true }));
    expect(issues.some((i) => i.code === "CALIBRATION_SAMPLE_CROSS_TENANT")).toBe(true);
  });
});
