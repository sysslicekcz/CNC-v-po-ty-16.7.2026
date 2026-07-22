import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { VarianceCauseAssignment, VarianceCauseAssignmentProps } from "./variance-cause";
import { classifyVarianceCauses, ClassifyVarianceCausesContext } from "./variance-cause-classifier";
import { CalculationVarianceAnalysis, VarianceMetricResult } from "./calculation-variance";

/**
 * Unit testy pro `VarianceCauseAssignment`/`VarianceCauseClassifier`
 * (AP-MCE-001 Fáze G §10, součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function assignmentProps(overrides: Partial<VarianceCauseAssignmentProps> = {}): VarianceCauseAssignmentProps {
  return {
    id: "vca:1",
    tenantId: "tenant:acme",
    calculationId: "calc:1",
    calculationRevision: 1,
    actualTimeRecordId: "atr:1",
    causeCode: "tool_wear",
    confidence: 0.5,
    evidence: [],
    affectedMetrics: [],
    classificationVersion: "v1",
    status: "suggested",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function metric(overrides: Partial<VarianceMetricResult> = {}): VarianceMetricResult {
  return {
    metric: "machine_time",
    predictedValueMin: 20,
    actualValueMin: 20,
    absoluteVarianceMin: 0,
    percentageVariance: 0,
    direction: "actual_equal",
    severity: "negligible",
    comparable: true,
    ...overrides,
  };
}

function analysis(metrics: VarianceMetricResult[]): CalculationVarianceAnalysis {
  return { calculationId: "calc:1", calculationRevision: 1, actualTimeRecordId: "atr:1", metrics, analyzedAt: NOW };
}

function context(overrides: Partial<ClassifyVarianceCausesContext> = {}): ClassifyVarianceCausesContext {
  return { operationCategory: "turning", waitingTimeMin: 0, downtimeMin: 0, reworkTimeMin: 0, batchTimeMin: 100, ...overrides };
}

describe("VarianceCauseAssignment (AP-MCE-001 Fáze G §10)", () => {
  it("1. status 'suggested' s confidence >= 1 vyhodí ValidationError (nesmí vydávat za jistotu)", () => {
    expect(() => VarianceCauseAssignment.create(assignmentProps({ status: "suggested", confidence: 1 }))).toThrow(ValidationError);
  });

  it("2. 'confirm' nastaví status 'confirmed' a confidence na 1", () => {
    const assignment = VarianceCauseAssignment.create(assignmentProps());
    const confirmed = assignment.confirm("user:1", NOW);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confidence).toBe(1);
    expect(assignment.status).toBe("suggested");
  });

  it("3. 'changeCause' změní causeCode a nastaví status 'changed'", () => {
    const assignment = VarianceCauseAssignment.create(assignmentProps());
    const changed = assignment.changeCause("machine_condition", "user:1", NOW);
    expect(changed.causeCode).toBe("machine_condition");
    expect(changed.status).toBe("changed");
  });

  it("4. 'reject' nastaví status 'rejected'", () => {
    const assignment = VarianceCauseAssignment.create(assignmentProps());
    const rejected = assignment.reject("user:1", NOW);
    expect(rejected.status).toBe("rejected");
  });
});

describe("classifyVarianceCauses (AP-MCE-001 Fáze G §10)", () => {
  it("5. žádné pravidlo neodpovídá => vrátí jeden návrh 'unknown'", () => {
    const suggestions = classifyVarianceCauses(analysis([metric()]), context());
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].causeCode).toBe("unknown");
  });

  it("6. výrazně vyšší machine_time (actual_higher, critical) navrhne 'tool_wear' i 'material_variation', seřazeno podle confidence", () => {
    const suggestions = classifyVarianceCauses(
      analysis([metric({ metric: "machine_time", direction: "actual_higher", severity: "critical", percentageVariance: 80 })]),
      context()
    );
    const codes = suggestions.map((s) => s.causeCode);
    expect(codes).toContain("tool_wear");
    expect(codes).toContain("material_variation");
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }
  });

  it("7. žádný návrh nikdy nepřekročí MAX_SUGGESTION_CONFIDENCE (0.75)", () => {
    const suggestions = classifyVarianceCauses(
      analysis([
        metric({ metric: "setup", direction: "actual_higher", severity: "critical", percentageVariance: 90 }),
        metric({ metric: "machine_time", direction: "actual_higher", severity: "critical", percentageVariance: 90 }),
        metric({ metric: "tool_change", direction: "actual_higher", severity: "critical", percentageVariance: 90 }),
      ]),
      context({ waitingTimeMin: 50, downtimeMin: 20, reworkTimeMin: 10 })
    );
    expect(suggestions.every((s) => s.confidence <= 0.75)).toBe(true);
  });

  it("8. vysoký downtimeMin poměr k batchTimeMin navrhne 'machine_breakdown'", () => {
    const suggestions = classifyVarianceCauses(analysis([metric()]), context({ downtimeMin: 10, batchTimeMin: 100 }));
    expect(suggestions.some((s) => s.causeCode === "machine_breakdown")).toBe(true);
  });
});
