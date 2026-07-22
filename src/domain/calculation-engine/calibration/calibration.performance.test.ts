import { describe, it, expect } from "vitest";
import { ActualTimeSegment, ActualTimeSegmentProps } from "./actual-time-segment";
import { resolveTimeOverlaps } from "./time-overlap-resolver";
import { detectCalibrationOutliers } from "./calibration-outlier-detector";
import { CalibrationSample, CalibrationSampleProps } from "./calibration-sample";
import { runCalibrationBacktest, splitSamplesForBacktest } from "./calibration-backtest-service";
import { WeightedMeanCalibrationMethod } from "./calibration-methods";
import { ActualTimeRecord, ActualTimeRecordProps } from "./actual-time-record";
import { CalculationCandidateForMatching, matchActualTimeToCalculation } from "./actual-time-calculation-matcher";
import { CalibrationProfile, CalibrationProfileProps } from "./calibration-profile";
import { resolveCalibrationProfile } from "./calibration-profile-resolver";

/**
 * Výkonové testy Fáze G (AP-MCE-001 §31) - stejný důvod jako Fáze C/D/E/F:
 * všechny funkce modulu skutečných časů/odchylek/kalibrace jsou čisté
 * synchronní funkce nad daty v paměti, worker adaptér NENÍ potřeba.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function segment(id: string, startMinuteOffset: number): ActualTimeSegment {
  const start = new Date(new Date("2025-01-01T00:00:00.000Z").getTime() + startMinuteOffset * 60000);
  const end = new Date(start.getTime() + 5 * 60000);
  return ActualTimeSegment.create({
    id,
    actualTimeRecordId: "atr:1",
    segmentType: "production",
    startedAt: start.toISOString(),
    finishedAt: end.toISOString(),
    durationMin: 5,
    source: "manual",
    sourceEventIds: [],
    overlapsAllowed: false,
  } satisfies ActualTimeSegmentProps);
}

function sample(id: string, predictedTimeMin: number, actualTimeMin: number): CalibrationSample {
  return CalibrationSample.create({
    id,
    tenantId: TENANT_ID,
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
    createdAt: `2025-01-${String((Number(id.split(":")[1]) % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
  } satisfies CalibrationSampleProps);
}

function record(overrides: Partial<ActualTimeRecordProps> = {}): ActualTimeRecord {
  return ActualTimeRecord.create({
    id: "atr:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    operationCategory: "turning",
    quantityPlanned: 10,
    quantityCompleted: 10,
    quantityScrapped: 0,
    sourceType: "manual",
    sourceSystem: "internal",
    measurementMethod: "explicit_duration",
    confidence: 0.8,
    status: "draft",
    recordedBy: "user:1",
    recordedAt: NOW,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function candidate(id: string): CalculationCandidateForMatching {
  return { calculationId: id, calculationRevision: 1, operationCategory: "milling", externalReferences: [], calculatedAt: NOW };
}

function profile(id: string, overrides: Partial<CalibrationProfileProps> = {}): CalibrationProfile {
  return CalibrationProfile.create({
    id,
    tenantId: TENANT_ID,
    name: id,
    scope: "machine",
    machineProfileId: `machine:${id}`,
    coefficientTargets: [],
    sampleCount: 20,
    effectiveSampleCount: 15,
    coefficientValues: {},
    confidenceScore: 0.8,
    status: "active",
    calibrationMethod: "weighted_mean",
    validFrom: "2025-01-01T00:00:00.000Z",
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe("Kalibrace - výkon (AP-MCE-001 Fáze G §31)", () => {
  it("resolveTimeOverlaps nad 500 segmenty proběhne pod 200 ms", () => {
    const segments = Array.from({ length: 500 }, (_, i) => segment(`seg:${i}`, i * 5));
    const start = performance.now();
    const result = resolveTimeOverlaps(segments);
    expect(performance.now() - start).toBeLessThan(200);
    expect(result.elapsedTimeMin).toBeGreaterThan(0);
  });

  it("detectCalibrationOutliers nad 2000 hodnotami proběhne pod 200 ms", () => {
    const values = Array.from({ length: 2000 }, (_, i) => (i % 97 === 0 ? 500 : 10 + (i % 5)));
    const start = performance.now();
    const result = detectCalibrationOutliers({ values });
    expect(performance.now() - start).toBeLessThan(200);
    expect(result.items).toHaveLength(2000);
  });

  it("runCalibrationBacktest nad 1000 vzorky proběhne pod 200 ms", () => {
    const samples = Array.from({ length: 1000 }, (_, i) => sample(`cs:${i}`, 100, 100 + (i % 20)));
    const start = performance.now();
    const { validationSamples } = splitSamplesForBacktest({ samples, method: "sample_id_hash" });
    const result = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 1.05, validationSamples });
    expect(performance.now() - start).toBeLessThan(200);
    expect(result.validationSampleCount).toBeGreaterThan(0);
  });

  it("WeightedMeanCalibrationMethod nad 1000 vzorky proběhne pod 200 ms", () => {
    const samples = Array.from({ length: 1000 }, (_, i) => sample(`cs:${i}`, 100, 100 + (i % 20)));
    const method = new WeightedMeanCalibrationMethod();
    const start = performance.now();
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples });
    expect(performance.now() - start).toBeLessThan(200);
    expect(target.sampleCount).toBe(1000);
  });

  it("matchActualTimeToCalculation nad 1000 kandidáty proběhne pod 200 ms", () => {
    const rec = record({ productionOrderId: "po:1", operationSequence: 1 });
    const candidates = Array.from({ length: 1000 }, (_, i) => candidate(`calc:${i}`));
    const start = performance.now();
    const result = matchActualTimeToCalculation(rec, candidates);
    expect(performance.now() - start).toBeLessThan(200);
    expect(result.status).toBe("unmatched");
  });

  it("resolveCalibrationProfile nad 500 kandidáty proběhne pod 200 ms", () => {
    const candidates = Array.from({ length: 500 }, (_, i) => profile(`cp:${i}`));
    const start = performance.now();
    const result = resolveCalibrationProfile({ candidates, tenantId: TENANT_ID, operationCategory: "turning", machineProfileId: "machine:cp:250", now: NOW });
    expect(performance.now() - start).toBeLessThan(200);
    expect(result.selectedProfile?.id).toBe("cp:250");
  });
});
