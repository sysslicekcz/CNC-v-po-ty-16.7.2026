import { describe, it, expect } from "vitest";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { ActualTimeSegment, ActualTimeSegmentProps } from "./actual-time-segment";
import { resolveTimeOverlaps } from "./time-overlap-resolver";
import { normalizeActualTime } from "./actual-time-normalizer";
import { analyzeCalculationVariance, AnalyzeVarianceInput } from "./calculation-variance";
import { classifyVarianceCauses } from "./variance-cause-classifier";
import { systemDefaultToleranceProfile } from "./variance-tolerance-profile";
import type { VarianceMetric } from "./variance-tolerance-profile";
import { CalibrationSample, CalibrationSampleProps } from "./calibration-sample";
import { WeightedMeanCalibrationMethod } from "./calibration-methods";
import { detectCalibrationOutliers } from "./calibration-outlier-detector";
import { splitSamplesForBacktest, runCalibrationBacktest } from "./calibration-backtest-service";
import { CalibrationProfile, CalibrationProfileProps } from "./calibration-profile";
import { resolveCalibrationProfile } from "./calibration-profile-resolver";
import { ShadowCalculationResult, evaluateShadowCalibration } from "./shadow-mode";
import { ActualTimeRecord, ActualTimeRecordProps } from "./actual-time-record";

/**
 * Golden master testy pro modul skutečných časů/odchylek/kalibrace
 * (AP-MCE-001 Fáze G §29) - šest (ze 60 celkových Fáze G scénářů §28)
 * referenčních případů se ZAMRAZENÝM očekávaným výstupem, stejná technika
 * jako Fáze C/D/E/F golden master testy. Každý scénář navíc ověřuje
 * DETERMINISMUS (dvě volání se shodným vstupem dají identický výstup).
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

function segment(overrides: Partial<ActualTimeSegmentProps> = {}): ActualTimeSegment {
  return ActualTimeSegment.create({
    id: overrides.id ?? "seg:1",
    actualTimeRecordId: "atr:1",
    segmentType: "production",
    startedAt: "2025-01-01T08:00:00.000Z",
    finishedAt: "2025-01-01T09:00:00.000Z",
    durationMin: 60,
    source: "manual",
    sourceEventIds: [],
    overlapsAllowed: false,
    ...overrides,
  });
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
    confidence: 1,
    status: "approved",
    recordedBy: "user:1",
    recordedAt: NOW,
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

function breakdown(): CalculationBreakdown {
  return CalculationBreakdown.createWithDefaults({
    rawUnitTime: Time.ofMinutes(2),
    setupTime: Time.ofMinutes(20),
    quantity: Quantity.ofPieces(10),
    handlingTime: Time.ofMinutes(0.5),
    finalInspectionTime: Time.ofMinutes(3),
    firstPieceInspectionTime: Time.ofMinutes(2),
    toolChangeTime: Time.ofMinutes(1),
    fixtureChangeTime: Time.zero(),
    inOperationInspectionTime: Time.zero(),
    measurementTime: Time.zero(),
    interOperationMoveTime: Time.zero(),
    auxiliaryTime: Time.zero(),
    waitingTime: Time.zero(),
    plannedToolChanges: 1,
    plannedFixtureChanges: 0,
  });
}

const ALL_METRICS: readonly VarianceMetric[] = ["setup", "machine_time", "operator_time", "handling", "inspection", "tool_change", "unit_time", "batch_time", "total_time"];

function toleranceByMetric(): Readonly<Record<VarianceMetric, ReturnType<typeof systemDefaultToleranceProfile>>> {
  return Object.fromEntries(ALL_METRICS.map((m) => [m, systemDefaultToleranceProfile(m)])) as Record<VarianceMetric, ReturnType<typeof systemDefaultToleranceProfile>>;
}

function sample(overrides: Partial<CalibrationSampleProps> = {}): CalibrationSample {
  return CalibrationSample.create({
    id: overrides.id ?? "cs:1",
    tenantId: TENANT_ID,
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
    createdAt: NOW,
    ...overrides,
  });
}

describe("Fáze G - golden master (AP-MCE-001 §29)", () => {
  it("1. plný řetěz: segmenty se překryvem -> normalizace -> analýza odchylek -> návrhy příčin", () => {
    // machine_cycle + operator_attendance je VŽDY povolený souběh (§4) - union
    // 08:00-09:40 = 100 min, bez varování.
    const machineCycle = segment({ id: "mc", segmentType: "machine_cycle", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:00:00.000Z" });
    const operatorAttendance = segment({ id: "oa", segmentType: "operator_attendance", startedAt: "2025-01-01T08:00:00.000Z", finishedAt: "2025-01-01T09:40:00.000Z" });
    const rec = record({ setupTimeMin: 20, quantityCompleted: 10, quantityScrapped: 0 });

    const overlap = resolveTimeOverlaps([machineCycle, operatorAttendance]);
    const normalized = normalizeActualTime(rec, overlap);

    const input: AnalyzeVarianceInput = {
      calculationId: "calc:1",
      calculationRevision: 1,
      breakdown: breakdown(),
      normalizedActualTime: normalized,
      actualToolChangeTimeMin: 1,
      toleranceByMetric: toleranceByMetric(),
      now: NOW,
    };
    const analysis = analyzeCalculationVariance(input);
    const suggestions = classifyVarianceCauses(analysis, { operationCategory: "turning", waitingTimeMin: 0, downtimeMin: 0, reworkTimeMin: 0, batchTimeMin: normalized.batchTimeMin });

    expect(overlap.elapsedTimeMin).toBeCloseTo(100, 9);
    expect(overlap.warnings).toHaveLength(0);
    expect(normalized.batchTimeMin).toBeCloseTo(100, 9);
    // predikovaný totalTimeMin (z breakdown()) = 51 min -> (100-51)/51*100
    expect(analysis.metrics.find((m) => m.metric === "total_time")?.percentageVariance).toBeCloseTo(96.07843137254902, 9);
    expect(suggestions[0].causeCode).toBeDefined();

    const second = resolveTimeOverlaps([machineCycle, operatorAttendance]);
    expect(normalize(second)).toEqual(normalize(overlap));
  });

  it("2. WeightedMeanCalibrationMethod nad fixní sadou vzorků dá zamrazenou proposedValue", () => {
    const samples = [
      sample({ id: "s1", predictedTimeMin: 100, actualTimeMin: 120, sampleWeight: 2, confidenceScore: 1 }),
      sample({ id: "s2", predictedTimeMin: 100, actualTimeMin: 100, sampleWeight: 1, confidenceScore: 1 }),
      sample({ id: "s3", predictedTimeMin: 200, actualTimeMin: 210, sampleWeight: 1, confidenceScore: 0.5 }),
    ];
    const method = new WeightedMeanCalibrationMethod();
    const target = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples });

    expect(target.proposedValue).toBeCloseTo(1.1214285714285714, 9);
    expect(target.sampleCount).toBe(3);

    const second = method.compute({ targetName: "cuttingCoefficient", originalValue: 1, minimumAllowed: 0.5, maximumAllowed: 2, samples });
    expect(normalize(second)).toEqual(normalize(target));
  });

  it("3. CalibrationOutlierDetector + CalibrationSample.withOutlierExclusion nad fixní sadou", () => {
    const variances = [5, 6, 4, 5, 6, 4, 5, 200];
    const detection = detectCalibrationOutliers({ values: variances, explicitTenantLimitPercent: 100 });
    const outlierItem = detection.items[7];
    expect(outlierItem.status).toBe("excluded");

    const outlierSample = sample({ id: "s-outlier", variancePercent: 200 });
    const excluded = outlierSample.withOutlierExclusion("statistical_outlier");
    expect(excluded.included).toBe(false);
    expect(excluded.exclusionReason).toBe("statistical_outlier");

    const second = detectCalibrationOutliers({ values: variances, explicitTenantLimitPercent: 100 });
    expect(normalize(second)).toEqual(normalize(detection));
  });

  it("4. CalibrationBacktestService: split + backtest nad fixní sadou 10 vzorků", () => {
    const samples = Array.from({ length: 10 }, (_, i) =>
      sample({ id: `s${i}`, createdAt: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, predictedTimeMin: 100, actualTimeMin: 100 + i, machineProfileId: "m:1" })
    );
    const split = splitSamplesForBacktest({ samples, method: "time_period", trainingRatio: 0.7 });
    const result = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 1.05, validationSamples: split.validationSamples });

    expect(split.trainingSamples).toHaveLength(7);
    expect(split.validationSamples).toHaveLength(3);
    expect(result.validationSampleCount).toBe(3);
    expect(result.maeBeforeMin).toBeCloseTo(8, 9);

    const second = runCalibrationBacktest({ targetName: "cuttingCoefficient", originalValue: 1, proposedValue: 1.05, validationSamples: split.validationSamples });
    expect(normalize(second)).toEqual(normalize(result));
  });

  it("5. CalibrationProfileResolver nad víceúrovňovou sadou kandidátů dá zamrazený výsledek", () => {
    function profile(overrides: Partial<CalibrationProfileProps> = {}): CalibrationProfile {
      return CalibrationProfile.create({
        id: overrides.id ?? "cp",
        tenantId: TENANT_ID,
        name: "Profile",
        scope: "tenant",
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

    const candidates = [
      profile({ id: "global", scope: "global" }),
      profile({ id: "tenant", scope: "tenant" }),
      profile({ id: "category", scope: "operation_category", operationCategory: "turning" }),
      profile({ id: "machine", scope: "machine", machineProfileId: "m:1" }),
    ];
    const result = resolveCalibrationProfile({ candidates, tenantId: TENANT_ID, operationCategory: "turning", machineProfileId: "m:1", now: NOW });

    expect(result.selectedProfile?.id).toBe("machine");
    expect(result.matchedScope).toBe("machine");
    expect(result.confidence).toBeCloseTo(0.8, 9);
    expect(result.fallbackPath).toEqual([]);

    const second = resolveCalibrationProfile({ candidates, tenantId: TENANT_ID, operationCategory: "turning", machineProfileId: "m:1", now: NOW });
    expect(second.selectedProfile?.id).toBe(result.selectedProfile?.id);
  });

  it("6. ShadowCalculationResult + evaluateShadowCalibration nad fixní sadou párů dá zamrazené doporučení", () => {
    const shadow = ShadowCalculationResult.create({
      id: "scr:1",
      tenantId: TENANT_ID,
      officialCalculationId: "calc:1",
      officialCalculationRevision: 1,
      shadowCalibrationProfileId: "cp:shadow",
      shadowCalibrationProfileVersion: 1,
      shadowBreakdown: { shadowCoefficientRatio: 0.9 },
      shadowTotalOperationTimeMin: 90,
      officialTotalOperationTimeMin: 100,
      computedAt: NOW,
    });
    expect(shadow.differenceMin).toBeCloseTo(-10, 9);
    expect(shadow.differencePercent).toBeCloseTo(-10, 9);

    const pairs = [
      { officialErrorMin: 12, shadowErrorMin: 3 },
      { officialErrorMin: 8, shadowErrorMin: 2 },
      { officialErrorMin: 15, shadowErrorMin: 5 },
      { officialErrorMin: 10, shadowErrorMin: 1 },
      { officialErrorMin: 9, shadowErrorMin: 4 },
      { officialErrorMin: 11, shadowErrorMin: 2 },
      { officialErrorMin: 13, shadowErrorMin: 3 },
      { officialErrorMin: 7, shadowErrorMin: 1 },
      { officialErrorMin: 14, shadowErrorMin: 4 },
      { officialErrorMin: 10, shadowErrorMin: 2 },
      { officialErrorMin: 9, shadowErrorMin: 3 },
    ];
    const evaluation = evaluateShadowCalibration(pairs, "cp:shadow", 1, NOW);
    expect(evaluation.recommendation).toBe("promote");
    expect(evaluation.improvementPercent).toBeCloseTo(74.57627118644068, 9);

    const second = evaluateShadowCalibration(pairs, "cp:shadow", 1, NOW);
    expect(normalize(second)).toEqual(normalize(evaluation));
  });
});
