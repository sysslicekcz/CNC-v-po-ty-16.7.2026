import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { CalibrationSample, CalibrationSampleProps } from "./calibration-sample";
import { splitSamplesForBacktest, runCalibrationBacktest } from "./calibration-backtest-service";

/**
 * Unit testy pro `CalibrationBacktestService` (AP-MCE-001 Fáze G §17,
 * součást 60 scénářů §28).
 */

function sample(overrides: Partial<CalibrationSampleProps> = {}): CalibrationSample {
  return CalibrationSample.create({
    id: overrides.id ?? "cs:1",
    tenantId: "tenant:acme",
    calculationId: "calc:1",
    calculationRevision: 1,
    actualTimeRecordId: "atr:1",
    operationCategory: "turning",
    toolProfileIds: [],
    predictedTimeMin: 100,
    actualTimeMin: 100,
    variancePercent: 0,
    quantity: 10,
    confidenceScore: 0.9,
    included: true,
    approvedForCalibration: true,
    rootCauseAssignments: [],
    sampleWeight: 1,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("splitSamplesForBacktest (AP-MCE-001 Fáze G §17)", () => {
  it("1. 'time_period' rozdělí podle createdAt s daným poměrem", () => {
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => sample({ id: `cs:${i}`, createdAt: `2025-01-${String(i).padStart(2, "0")}T00:00:00.000Z` }));
    const { trainingSamples, validationSamples } = splitSamplesForBacktest({ samples, method: "time_period", trainingRatio: 0.7 });
    expect(trainingSamples).toHaveLength(7);
    expect(validationSamples).toHaveLength(3);
  });

  it("2. 'sample_id_hash' je deterministické (stejný vstup dá stejný výstup)", () => {
    const samples = [1, 2, 3, 4, 5].map((i) => sample({ id: `cs:${i}` }));
    const first = splitSamplesForBacktest({ samples, method: "sample_id_hash" });
    const second = splitSamplesForBacktest({ samples, method: "sample_id_hash" });
    expect(first.trainingSamples.map((s) => s.id)).toEqual(second.trainingSamples.map((s) => s.id));
    expect(first.validationSamples.map((s) => s.id)).toEqual(second.validationSamples.map((s) => s.id));
  });

  it("3. 'explicit_period' bez 'explicitValidationPeriod' vyhodí ValidationError", () => {
    expect(() => splitSamplesForBacktest({ samples: [sample()], method: "explicit_period" })).toThrow(ValidationError);
  });
});

describe("runCalibrationBacktest (AP-MCE-001 Fáze G §17)", () => {
  it("4. zlepšení MAE bez zhoršení podskupiny => passed: true", () => {
    const samples = Array.from({ length: 5 }, (_, i) => sample({ id: `cs:${i}`, predictedTimeMin: 100, actualTimeMin: 105, machineProfileId: "m:1" }));
    const result = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 1.05, validationSamples: samples });
    expect(result.maeAfterMin).toBeLessThanOrEqual(result.maeBeforeMin);
    expect(result.passed).toBe(true);
  });

  it("5. prázdná validační množina vrátí passed: false a CALIBRATION_BACKTEST_FAILED", () => {
    const result = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 1.1, validationSamples: [] });
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.code === "CALIBRATION_BACKTEST_FAILED")).toBe(true);
  });

  it("6. návrh zhoršující výraznou podskupinu (byť nezhorší celkový průměr) NESMÍ projít automaticky", () => {
    // Skupina strojů "m:1" (3 vzorky) se zlepší směrem k 0 chybě po škálování 0,
    // ale zbytek datasetu (jiné stroje, "m:2") se výrazně zhorší.
    const improvedGroup = Array.from({ length: 3 }, (_, i) => sample({ id: `improve:${i}`, predictedTimeMin: 100, actualTimeMin: 0, machineProfileId: "m:1" }));
    const worsenedGroup = Array.from({ length: 3 }, (_, i) => sample({ id: `worsen:${i}`, predictedTimeMin: 100, actualTimeMin: 105, machineProfileId: "m:2" }));
    const result = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 0, validationSamples: [...improvedGroup, ...worsenedGroup] });
    expect(result.maeAfterMin).toBeLessThanOrEqual(result.maeBeforeMin);
    expect(result.stabilityByMachine.some((g) => g.groupKey === "m:2" && g.worsenedSignificantly)).toBe(true);
    expect(result.passed).toBe(false);
  });
});
