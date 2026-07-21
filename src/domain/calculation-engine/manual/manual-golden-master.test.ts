import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { ManualTimeStandard } from "./manual-time-standard";
import { ManualTimeProfileSnapshot } from "./manual-time-profile-snapshot";
import { ManualOperationCalculationStrategy } from "./manual-operation-calculation-strategy";
import { ManualOperationCalculationInput } from "./manual-operation-calculation-input";

/**
 * Golden master testy pro ruční operace (AP-MCE-001 Fáze F §22) - 3 (ze 6
 * celkových Fáze F) referenční případy se ZAMRAZENÝM očekávaným
 * `manualDetail`, stejná technika jako Fáze C/D/E golden master testy.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function baseContext(overrides: Partial<CalculationContext> = {}): CalculationContext {
  return {
    ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }),
    ...overrides,
  };
}

function baseInput(overrides: Partial<ManualOperationCalculationInput> = {}): ManualOperationCalculationInput {
  return { operationCategory: "manual", operationTypeId: "op-type:manual", quantity: 100, materialId: "material:1", ...overrides };
}

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const strategy = new ManualOperationCalculationStrategy();

describe("ManualOperationCalculationStrategy - golden master (AP-MCE-001 Fáze F §22)", () => {
  it("1. jednoduché odjehlení bez features (baseUnitTimeMin, per_piece)", () => {
    const input = baseInput({
      manualOperationSubtype: "deburring",
      baseUnitTimeMin: 0.8,
      setupTimeMin: 5,
      handlingTimePerPieceMin: 0.1,
      operatorSkillCoefficient: 1,
    });
    const breakdown = strategy.calculate(input, baseContext());

    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(95, 9);
    expect(breakdown.manualDetail?.unitTimeMin).toBeCloseTo(0.8, 9);
    expect(breakdown.manualDetail?.confidenceScore).toBeCloseTo(0.8, 9);

    const second = strategy.calculate(input, baseContext());
    expect(normalize(second.manualDetail)).toEqual(normalize(breakdown.manualDetail));
  });

  it("2. víc-featurová operace (per_piece + per_batch, koeficienty)", () => {
    const input = baseInput({
      quantity: 20,
      batchSize: 5,
      productionSeriality: "small_batch",
      features: [
        {
          id: "f1",
          sequence: 0,
          subtype: "cleaning",
          quantityBasis: "per_piece",
          timeBasis: "explicit",
          baseTimeMin: 1.5,
          complexityLevel: "medium",
        },
        {
          id: "f2",
          sequence: 1,
          subtype: "packing",
          quantityBasis: "per_batch",
          timeBasis: "explicit",
          baseTimeMin: 4,
        },
      ],
    });
    const breakdown = strategy.calculate(input, baseContext());

    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(53.90000000000001, 9);
    expect(breakdown.manualDetail?.features[0].adjustedTimeMin).toBeCloseTo(1.815, 9);
    expect(breakdown.manualDetail?.features[1].adjustedTimeMin).toBeCloseTo(4.4, 9);

    const second = strategy.calculate(input, baseContext());
    expect(normalize(second.manualDetail)).toEqual(normalize(breakdown.manualDetail));
  });

  it("3. čas z resolvnutého ManualTimeStandard (timeBasis 'template', tenant standard)", () => {
    const standard = ManualTimeStandard.create({
      id: "standard:1",
      tenantId: TENANT_ID,
      operationSubtype: "polishing",
      standardName: "Leštění - tenant standard",
      standardVersion: "1.0",
      source: "tenant_standard",
      baseTimeMin: 2,
      quantityBasis: "per_piece",
      validFrom: "2024-01-01T00:00:00.000Z",
      recordVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const snapshot = ManualTimeProfileSnapshot.forManualTimeStandard(standard, { createdAt: NOW });

    const input = baseInput({
      quantity: 10,
      features: [{ id: "f1", sequence: 0, subtype: "polishing", quantityBasis: "per_piece", timeBasis: "template" }],
    });
    const breakdown = strategy.calculate(input, baseContext({ manualTimeStandardsByFeatureId: { f1: snapshot } }));

    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(20, 9);
    expect(breakdown.manualDetail?.features[0].source).toBe("tenant_standard");
    expect(breakdown.manualDetail?.confidenceScore).toBeCloseTo(1, 9);

    const second = strategy.calculate(input, baseContext({ manualTimeStandardsByFeatureId: { f1: snapshot } }));
    expect(normalize(second.manualDetail)).toEqual(normalize(breakdown.manualDetail));
  });
});
