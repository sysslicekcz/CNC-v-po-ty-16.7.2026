import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { CalibrationSample, CalibrationSampleProps } from "./calibration-sample";
import { WeightedMeanCalibrationMethod, MedianCalibrationMethod, TrimmedMeanCalibrationMethod } from "./calibration-methods";

/**
 * Unit testy pro tři implementace `CalibrationMethod` (AP-MCE-001 Fáze G
 * §15, součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function sample(predictedTimeMin: number, actualTimeMin: number, overrides: Partial<CalibrationSampleProps> = {}): CalibrationSample {
  return CalibrationSample.create({
    id: `cs:${Math.random()}`,
    tenantId: "tenant:acme",
    calculationId: "calc:1",
    calculationRevision: 1,
    actualTimeRecordId: "atr:1",
    operationCategory: "turning",
    toolProfileIds: [],
    predictedTimeMin,
    actualTimeMin,
    variancePercent: ((actualTimeMin - predictedTimeMin) / predictedTimeMin) * 100,
    quantity: 10,
    confidenceScore: 0.9,
    included: true,
    approvedForCalibration: true,
    rootCauseAssignments: [],
    sampleWeight: 1,
    createdAt: NOW,
    ...overrides,
  });
}

describe("WeightedMeanCalibrationMethod (AP-MCE-001 Fáze G §15)", () => {
  it("1. koeficient se navrhne úměrně skutečnost/predikce poměru se zohledněním váhy a confidence", () => {
    const method = new WeightedMeanCalibrationMethod();
    const samples = [sample(100, 120, { sampleWeight: 2, confidenceScore: 1 }), sample(100, 100, { sampleWeight: 1, confidenceScore: 1 })];
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples });
    // vážený poměr = (1.2*2 + 1.0*1) / 3 = 1.1333...
    expect(target.proposedValue).toBeCloseTo(1.1333333333333333, 6);
  });

  it("2. bez použitelných vzorků vrátí INSUFFICIENT_SAMPLE_COUNT warning a proposedValue == originalValue", () => {
    const method = new WeightedMeanCalibrationMethod();
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples: [] });
    expect(target.proposedValue).toBe(1);
    expect(target.warnings.some((w) => w.code === "INSUFFICIENT_SAMPLE_COUNT")).toBe(true);
  });
});

describe("MedianCalibrationMethod (AP-MCE-001 Fáze G §15)", () => {
  it("3. medián implikovaných poměrů je odolný proti extrémům", () => {
    const method = new MedianCalibrationMethod();
    const samples = [sample(100, 100), sample(100, 105), sample(100, 1000)];
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 20, samples });
    // implied ratios: 1, 1.05, 10 => medián 1.05
    expect(target.proposedValue).toBeCloseTo(1.05, 9);
  });
});

describe("TrimmedMeanCalibrationMethod (AP-MCE-001 Fáze G §15)", () => {
  it("4. ořízne konfigurovaný podíl extrémů z obou konců před průměrováním", () => {
    const method = new TrimmedMeanCalibrationMethod(0.2);
    const samples = [sample(100, 50), sample(100, 100), sample(100, 100), sample(100, 100), sample(100, 500)];
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.1, maximumAllowed: 10, samples });
    // ratios sorted: 0.5,1,1,1,5 - trimCount = floor(5*0.2)=1, trimmed: [1,1,1] => mean 1
    expect(target.proposedValue).toBeCloseTo(1, 9);
  });

  it("5. 'trimFraction' mimo [0, 0.5) vyhodí ValidationError", () => {
    expect(() => new TrimmedMeanCalibrationMethod(0.5)).toThrow(ValidationError);
    expect(() => new TrimmedMeanCalibrationMethod(-0.1)).toThrow(ValidationError);
  });

  it("6. proposedValue se ořízne (clamp) do [minimumAllowed, maximumAllowed]", () => {
    const method = new TrimmedMeanCalibrationMethod(0);
    const samples = [sample(100, 1000)];
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples });
    expect(target.proposedValue).toBe(2);
    expect(target.warnings.some((w) => w.code === "CALIBRATION_COEFFICIENT_OUT_OF_RANGE")).toBe(false);
  });
});
