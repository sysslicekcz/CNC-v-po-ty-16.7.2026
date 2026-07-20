import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { InvalidStateError } from "@/domain/errors/invalid-state-error";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { CalculationBreakdown } from "./calculation-breakdown";
import { CalculationResult } from "./calculation-result";

function sampleBreakdown(): CalculationBreakdown {
  return CalculationBreakdown.createWithDefaults({
    rawUnitTime: Time.ofMinutes(2),
    setupTime: Time.ofMinutes(10),
    firstPieceInspectionTime: Time.zero(),
    finalInspectionTime: Time.zero(),
    toolChangeTime: Time.zero(),
    fixtureChangeTime: Time.zero(),
    handlingTime: Time.zero(),
    inOperationInspectionTime: Time.zero(),
    measurementTime: Time.zero(),
    interOperationMoveTime: Time.zero(),
    auxiliaryTime: Time.zero(),
    waitingTime: Time.zero(),
    quantity: Quantity.ofPieces(5),
    plannedToolChanges: 0,
    plannedFixtureChanges: 0,
  });
}

function completedResult(overrides: Partial<Parameters<typeof CalculationResult.create>[0]> = {}): CalculationResult {
  return CalculationResult.create({
    id: "calc:1",
    tenantId: "tenant:acme",
    calculationRequestId: "calc-req:1",
    status: "completed",
    breakdown: sampleBreakdown(),
    confidenceScore: 0.9,
    issues: [],
    engineVersion: "mce-v1",
    strategyVersion: "test-1",
    ruleVersionId: "rv:1",
    calculatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("CalculationResult", () => {
  it("vyžaduje breakdown, pokud status není 'failed'", () => {
    expect(() => CalculationResult.create({
      id: "calc:1", tenantId: "t", calculationRequestId: "r", status: "completed",
      issues: [], engineVersion: "mce-v1", ruleVersionId: "rv:1", calculatedAt: "2025-01-01T00:00:00.000Z",
    })).toThrow(ValidationError);
  });

  it("dovolí 'failed' bez breakdown", () => {
    expect(() => CalculationResult.create({
      id: "calc:1", tenantId: "t", calculationRequestId: "r", status: "failed",
      issues: [{ code: "MACHINE_NOT_FOUND", severity: "error", message: "…" }],
      engineVersion: "mce-v1", ruleVersionId: "rv:1", calculatedAt: "2025-01-01T00:00:00.000Z",
    })).not.toThrow();
  });

  it("odmítne confidenceScore mimo rozsah 0..1", () => {
    expect(() => completedResult({ confidenceScore: 1.5 })).toThrow(ValidationError);
    expect(() => completedResult({ confidenceScore: -0.1 })).toThrow(ValidationError);
  });

  it("computedOperationTime čte z breakdown.totalOperationTime", () => {
    const result = completedResult();
    expect(result.computedOperationTime.minutes).toBeCloseTo(result.breakdown!.totalOperationTime.minutes);
  });

  it("computedOperationTime vyhodí InvalidStateError, pokud breakdown chybí", () => {
    const failed = CalculationResult.create({
      id: "calc:1", tenantId: "t", calculationRequestId: "r", status: "failed",
      issues: [], engineVersion: "mce-v1", ruleVersionId: "rv:1", calculatedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(() => failed.computedOperationTime).toThrow(InvalidStateError);
  });

  it("finalOperationTime bez ruční úpravy == computedOperationTime", () => {
    const result = completedResult();
    expect(result.finalOperationTime.minutes).toBeCloseTo(result.computedOperationTime.minutes);
  });

  it("withManualOverride vrací NOVOU instanci a nemutuje původní (immutabilita)", () => {
    const original = completedResult();
    const overridden = original.withManualOverride(42);
    expect(original.manualOverrideMinutes).toBeUndefined();
    expect(overridden.manualOverrideMinutes).toBe(42);
    expect(overridden.finalOperationTime.minutes).toBe(42);
    expect(overridden).not.toBe(original);
  });

  it("withManualOverride(undefined) zruší předchozí přepis", () => {
    const overridden = completedResult().withManualOverride(42).withManualOverride(undefined);
    expect(overridden.manualOverrideMinutes).toBeUndefined();
  });

  it("withManualOverride odmítne zápornou hodnotu", () => {
    expect(() => completedResult().withManualOverride(-5)).toThrow(ValidationError);
  });

  it("asSuperseded vrací NOVOU instanci se statusem 'superseded' a nemutuje původní", () => {
    const original = completedResult();
    const superseded = original.asSuperseded();
    expect(original.status).toBe("completed");
    expect(superseded.status).toBe("superseded");
    expect(superseded.isSuperseded).toBe(true);
    expect(superseded).not.toBe(original);
  });

  it("asSuperseded je idempotentní (druhé volání vrátí stejný stav)", () => {
    const once = completedResult().asSuperseded();
    const twice = once.asSuperseded();
    expect(twice.status).toBe("superseded");
  });

  it("issues je zmrazené pole (immutabilita)", () => {
    const result = completedResult({ issues: [{ code: "X", severity: "information", message: "m" }] });
    expect(() => {
      (result.issues as unknown as { push: (x: unknown) => void }).push({ code: "Y", severity: "error", message: "m" });
    }).toThrow();
  });
});
