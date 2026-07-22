import { describe, it, expect } from "vitest";
import { ActualTimeRecord, ActualTimeRecordProps } from "./actual-time-record";
import { CalculationCandidateForMatching, matchActualTimeToCalculation } from "./actual-time-calculation-matcher";

/**
 * Unit testy pro `ActualTimeCalculationMatcher` (AP-MCE-001 Fáze G §6,
 * součást 60 scénářů §28).
 */

const NOW = "2025-01-01T00:00:00.000Z";

function record(overrides: Partial<ActualTimeRecordProps> = {}): ActualTimeRecord {
  return ActualTimeRecord.create({
    id: "atr:1",
    tenantId: "tenant:acme",
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

function candidate(overrides: Partial<CalculationCandidateForMatching> = {}): CalculationCandidateForMatching {
  return {
    calculationId: "calc:1",
    calculationRevision: 1,
    operationCategory: "turning",
    externalReferences: [],
    calculatedAt: NOW,
    ...overrides,
  };
}

describe("matchActualTimeToCalculation (AP-MCE-001 Fáze G §6)", () => {
  it("1. explicitní calculationId+revize s jedním kandidátem se spáruje automaticky", () => {
    const rec = record({ calculationId: "calc:1", calculationRevision: 1 });
    const result = matchActualTimeToCalculation(rec, [candidate()]);
    expect(result.status).toBe("matched");
    expect(result.matchMethod).toBe("explicit_calculation_id");
    expect(result.matchedCalculationId).toBe("calc:1");
  });

  it("2. explicitní calculationId s víc odpovídajícími revizemi je ambiguous", () => {
    const rec = record({ calculationId: "calc:1" });
    const result = matchActualTimeToCalculation(rec, [candidate({ calculationRevision: 1 }), candidate({ calculationRevision: 2 })]);
    expect(result.status).toBe("ambiguous");
    expect(result.alternativeCandidates).toHaveLength(2);
  });

  it("3. external reference match má prioritu před production order match", () => {
    const rec = record({
      externalReferences: [{ externalSystemId: "sys:1", externalEntityType: "operation", externalId: "op-42" }],
      productionOrderId: "po:1",
      operationSequence: 1,
    });
    const candidates = [
      candidate({ calculationId: "calc:ref", externalReferences: [{ externalSystemId: "sys:1", externalEntityType: "operation", externalId: "op-42" }] }),
      candidate({ calculationId: "calc:po", productionOrderId: "po:1", operationSequence: 1 }),
    ];
    const result = matchActualTimeToCalculation(rec, candidates);
    expect(result.matchMethod).toBe("external_operation_reference");
    expect(result.matchedCalculationId).toBe("calc:ref");
  });

  it("4. production order + operation sequence se spáruje, pokud external reference chybí", () => {
    const rec = record({ productionOrderId: "po:1", operationSequence: 3 });
    const result = matchActualTimeToCalculation(rec, [candidate({ productionOrderId: "po:1", operationSequence: 3 })]);
    expect(result.status).toBe("matched");
    expect(result.matchMethod).toBe("production_order_and_sequence");
  });

  it("5. kategorie+stroj+období (MVP náhrada za drawing/item) má nízkou confidence pod prahem => ambiguous", () => {
    const rec = record({ machineId: "machine:1" });
    const result = matchActualTimeToCalculation(rec, [candidate({ machineId: "machine:1" })]);
    expect(result.status).toBe("ambiguous");
    expect(result.matchMethod).toBe("item_type_machine_period");
    expect(result.warnings.some((w) => w.code === "LOW_MATCH_CONFIDENCE")).toBe(true);
  });

  it("6. žádný kandidát neodpovídá => unmatched s CALCULATION_MATCH_NOT_FOUND", () => {
    const rec = record();
    const result = matchActualTimeToCalculation(rec, [candidate({ operationCategory: "milling" })]);
    expect(result.status).toBe("unmatched");
    expect(result.warnings.some((w) => w.code === "CALCULATION_MATCH_NOT_FOUND")).toBe(true);
  });
});
