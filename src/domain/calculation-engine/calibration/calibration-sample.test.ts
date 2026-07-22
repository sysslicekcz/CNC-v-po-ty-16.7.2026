import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { CalibrationSample, CalibrationSampleProps, CalibrationSampleEligibilityInput, evaluateCalibrationSampleEligibility } from "./calibration-sample";

/**
 * Unit testy pro `CalibrationSample`/eligibility pravidla (AP-MCE-001 Fáze G
 * §11, součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function eligibilityInput(overrides: Partial<CalibrationSampleEligibilityInput> = {}): CalibrationSampleEligibilityInput {
  return {
    matchConfidence: 0.9,
    actualTimeApproved: true,
    hasCompleteData: true,
    hasCriticalUnexplainedDowntime: false,
    quantity: 10,
    isReworkProperlyMarked: true,
    resultConfidenceScore: 0.9,
    operationChangedVsCalculatedProcedure: false,
    ...overrides,
  };
}

function sampleProps(overrides: Partial<CalibrationSampleProps> = {}): CalibrationSampleProps {
  return {
    id: "cs:1",
    tenantId: "tenant:acme",
    calculationId: "calc:1",
    calculationRevision: 1,
    actualTimeRecordId: "atr:1",
    operationCategory: "turning",
    toolProfileIds: [],
    predictedTimeMin: 100,
    actualTimeMin: 110,
    variancePercent: 10,
    quantity: 10,
    confidenceScore: 0.9,
    included: true,
    approvedForCalibration: false,
    rootCauseAssignments: [],
    sampleWeight: 1,
    createdAt: NOW,
    ...overrides,
  };
}

describe("evaluateCalibrationSampleEligibility (AP-MCE-001 Fáze G §11)", () => {
  it("1. všechny podmínky splněny => included: true", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput())).toEqual({ included: true });
  });

  it("2. nízká matchConfidence (první podmínka) vyloučí vzorek s 'low_match_confidence'", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput({ matchConfidence: 0.5 }))).toEqual({ included: false, exclusionReason: "low_match_confidence" });
  });

  it("3. neschválený ActualTimeRecord vyloučí s 'actual_time_not_approved'", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput({ actualTimeApproved: false }))).toEqual({ included: false, exclusionReason: "actual_time_not_approved" });
  });

  it("4. nevysvětlený kritický prostoj vyloučí s 'unexplained_critical_downtime'", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput({ hasCriticalUnexplainedDowntime: true }))).toEqual({ included: false, exclusionReason: "unexplained_critical_downtime" });
  });

  it("5. nesprávně označený rework vyloučí s 'unmarked_rework'", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput({ isReworkProperlyMarked: false }))).toEqual({ included: false, exclusionReason: "unmarked_rework" });
  });

  it("6. změněná operace oproti procesu z výpočtu vyloučí s 'operation_changed' (poslední podmínka)", () => {
    expect(evaluateCalibrationSampleEligibility(eligibilityInput({ operationChangedVsCalculatedProcedure: true }))).toEqual({ included: false, exclusionReason: "operation_changed" });
  });
});

describe("CalibrationSample (AP-MCE-001 Fáze G §11)", () => {
  it("7. vyřazený vzorek bez 'exclusionReason' vyhodí ValidationError", () => {
    expect(() => CalibrationSample.create(sampleProps({ included: false }))).toThrow(ValidationError);
  });

  it("8. vyřazený vzorek s 'approvedForCalibration: true' vyhodí ValidationError", () => {
    expect(() => CalibrationSample.create(sampleProps({ included: false, exclusionReason: "zero_quantity", approvedForCalibration: true }))).toThrow(ValidationError);
  });

  it("9. 'withOutlierExclusion' vyřadí vzorek s 'statistical_outlier' a zruší schválení", () => {
    const sample = CalibrationSample.create(sampleProps({ approvedForCalibration: true, approvedAt: NOW }));
    const excluded = sample.withOutlierExclusion("statistical_outlier");
    expect(excluded.included).toBe(false);
    expect(excluded.exclusionReason).toBe("statistical_outlier");
    expect(excluded.approvedForCalibration).toBe(false);
  });

  it("10. 'withManualInclusion' znovu zahrne dřív vyřazený vzorek", () => {
    const sample = CalibrationSample.create(sampleProps({ included: false, exclusionReason: "zero_quantity" }));
    const included = sample.withManualInclusion(NOW);
    expect(included.included).toBe(true);
    expect(included.exclusionReason).toBeUndefined();
    expect(included.approvedForCalibration).toBe(true);
  });
});
