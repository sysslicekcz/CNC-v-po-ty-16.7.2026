import { describe, it, expect } from "vitest";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { analyzeCalculationVariance, extractPredictedTimeBreakdown, AnalyzeVarianceInput } from "./calculation-variance";
import { NormalizedActualTime } from "./actual-time-normalizer";
import { systemDefaultToleranceProfile } from "./variance-tolerance-profile";
import type { VarianceMetric } from "./variance-tolerance-profile";

/**
 * Unit testy pro `CalculationVarianceAnalysis` (AP-MCE-001 Fáze G §8,
 * součást 60 scénářů §28).
 */

const ALL_METRICS: readonly VarianceMetric[] = ["setup", "machine_time", "operator_time", "handling", "inspection", "tool_change", "unit_time", "batch_time", "total_time"];

function toleranceByMetric(): Readonly<Record<VarianceMetric, ReturnType<typeof systemDefaultToleranceProfile>>> {
  return Object.fromEntries(ALL_METRICS.map((m) => [m, systemDefaultToleranceProfile(m)])) as Record<VarianceMetric, ReturnType<typeof systemDefaultToleranceProfile>>;
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

function normalized(overrides: Partial<NormalizedActualTime> = {}): NormalizedActualTime {
  return {
    actualTimeRecordId: "atr:1",
    quantityCompleted: 10,
    quantityScrapped: 0,
    elapsedTimeMin: 45,
    setupTimeMin: 20,
    productiveMachineTimeMin: 20,
    productiveOperatorTimeMin: 5,
    handlingTimeMin: 5,
    inspectionTimeMin: 5,
    waitingTimeMin: 0,
    downtimeMin: 0,
    reworkTimeMin: 0,
    goodPieceUnitTimeMin: 2,
    producedPieceUnitTimeMin: 2,
    batchTimeMin: 45,
    normalizationVersion: "actual-time-normalization-1.0.0",
    confidenceScore: 1,
    warnings: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<AnalyzeVarianceInput> = {}): AnalyzeVarianceInput {
  return {
    calculationId: "calc:1",
    calculationRevision: 1,
    breakdown: breakdown(),
    normalizedActualTime: normalized(),
    toleranceByMetric: toleranceByMetric(),
    now: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("extractPredictedTimeBreakdown (AP-MCE-001 Fáze G §8)", () => {
  it("1. odvodí predikci z base-class getterů CalculationBreakdown", () => {
    const predicted = extractPredictedTimeBreakdown(breakdown());
    expect(predicted.setupTimeMin).toBeCloseTo(20, 9);
    expect(predicted.machineTimeMin).toBeCloseTo(20, 9);
    expect(predicted.toolChangeTimeMin).toBeCloseTo(1, 9);
  });
});

describe("analyzeCalculationVariance (AP-MCE-001 Fáze G §8)", () => {
  it("2. přesně devět metrik se vrací v analýze", () => {
    const analysis = analyzeCalculationVariance(baseInput());
    expect(analysis.metrics).toHaveLength(9);
    expect(analysis.metrics.map((m) => m.metric).sort()).toEqual([...ALL_METRICS].sort());
  });

  it("3. shoda predikce/skutečnosti je 'negligible' se směrem 'actual_equal'", () => {
    const analysis = analyzeCalculationVariance(baseInput());
    const setup = analysis.metrics.find((m) => m.metric === "setup")!;
    expect(setup.direction).toBe("actual_equal");
    expect(setup.severity).toBe("negligible");
  });

  it("4. výrazně vyšší skutečnost než predikce se klasifikuje jako 'critical'/'actual_higher'", () => {
    const analysis = analyzeCalculationVariance(baseInput({ normalizedActualTime: normalized({ productiveMachineTimeMin: 100 }) }));
    const machine = analysis.metrics.find((m) => m.metric === "machine_time")!;
    expect(machine.direction).toBe("actual_higher");
    expect(machine.severity).toBe("critical");
  });

  it("5. chybějící actualToolChangeTimeMin označí tool_change jako neporovnatelné", () => {
    const analysis = analyzeCalculationVariance(baseInput({ actualToolChangeTimeMin: undefined }));
    const toolChange = analysis.metrics.find((m) => m.metric === "tool_change")!;
    expect(toolChange.comparable).toBe(false);
    expect(toolChange.reasonIfNotComparable).toBeDefined();
  });

  it("6. chybějící goodPieceUnitTimeMin označí unit_time jako neporovnatelné", () => {
    const analysis = analyzeCalculationVariance(baseInput({ normalizedActualTime: normalized({ goodPieceUnitTimeMin: undefined }) }));
    const unitTime = analysis.metrics.find((m) => m.metric === "unit_time")!;
    expect(unitTime.comparable).toBe(false);
  });
});
