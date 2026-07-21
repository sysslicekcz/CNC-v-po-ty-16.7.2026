import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { ManualTimeStandard } from "./manual-time-standard";
import { ManualTimeProfileSnapshot } from "./manual-time-profile-snapshot";
import { ManualOperationCalculationStrategy } from "./manual-operation-calculation-strategy";
import { ManualOperationCalculationInput } from "./manual-operation-calculation-input";
import { ManualOperationFeature } from "./manual-operation-feature";

/**
 * 20 unit/integration test scénářů pro `ManualOperationCalculationStrategy`
 * (AP-MCE-001 Fáze F §21, scénáře 1-20) - stejná technika jako Fáze C/D/E
 * `*-calculation-strategy.test.ts`.
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
  return { operationCategory: "manual", operationTypeId: "op-type:manual", quantity: 10, materialId: "material:1", ...overrides };
}

function feature(overrides: Partial<ManualOperationFeature> = {}): ManualOperationFeature {
  return { id: "f1", sequence: 0, subtype: "cleaning", quantityBasis: "per_piece", timeBasis: "explicit", baseTimeMin: 1, ...overrides };
}

const strategy = new ManualOperationCalculationStrategy();

describe("ManualOperationCalculationStrategy (AP-MCE-001 Fáze F §21)", () => {
  it("1. validní minimální vstup bez features projde bez chyb a spočítá se", () => {
    const input = baseInput({ baseUnitTimeMin: 2 });
    expect(strategy.validate(input, baseContext())).toEqual([]);
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(20, 9);
  });

  it("2. quantity <= 0 vrátí INVALID_REPETITION_COUNT", () => {
    const input = baseInput({ quantity: 0, baseUnitTimeMin: 1 });
    const issues = strategy.validate(input, baseContext());
    expect(issues.some((i) => i.code === "INVALID_REPETITION_COUNT")).toBe(true);
  });

  it("3. quantity není celé číslo vrátí INVALID_REPETITION_COUNT", () => {
    const input = baseInput({ quantity: 2.5, baseUnitTimeMin: 1 });
    const issues = strategy.validate(input, baseContext());
    expect(issues.some((i) => i.code === "INVALID_REPETITION_COUNT")).toBe(true);
  });

  it("4. bez features a bez baseUnitTimeMin vrátí INVALID_BASE_TIME", () => {
    const input = baseInput();
    const issues = strategy.validate(input, baseContext());
    expect(issues.some((i) => i.code === "INVALID_BASE_TIME" && i.severity === "error")).toBe(true);
  });

  it("5. explicitní feature se zápornym baseTimeMin vrátí INVALID_BASE_TIME", () => {
    const input = baseInput({ features: [feature({ baseTimeMin: -1 })] });
    const issues = strategy.validate(input, baseContext());
    expect(issues.some((i) => i.code === "INVALID_BASE_TIME")).toBe(true);
  });

  it("6. záporný/neceločíselný repetitionCount vrátí INVALID_REPETITION_COUNT", () => {
    const input = baseInput({ features: [feature({ repetitionCount: -2 })] });
    const issues = strategy.validate(input, baseContext());
    expect(issues.some((i) => i.code === "INVALID_REPETITION_COUNT")).toBe(true);
  });

  it("7. per_piece škáluje lineárně s quantity", () => {
    const input10 = baseInput({ quantity: 10, features: [feature({ baseTimeMin: 2 })] });
    const input20 = baseInput({ quantity: 20, features: [feature({ baseTimeMin: 2 })] });
    const b10 = strategy.calculate(input10, baseContext());
    const b20 = strategy.calculate(input20, baseContext());
    expect(b20.manualDetail!.totalOperationTimeMin).toBeCloseTo(2 * b10.manualDetail!.totalOperationTimeMin, 9);
  });

  it("8. per_batch škáluje s ceil(quantity/batchSize)", () => {
    const input = baseInput({ quantity: 21, batchSize: 10, features: [feature({ quantityBasis: "per_batch", baseTimeMin: 5 })] });
    const breakdown = strategy.calculate(input, baseContext());
    // ceil(21/10) = 3 dávky × 5 min
    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(15, 9);
  });

  it("9. per_order/per_occurrence se počítá jako JEDEN výskyt bez ohledu na quantity", () => {
    const input = baseInput({ quantity: 50, features: [feature({ quantityBasis: "per_order", baseTimeMin: 8 })] });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(8, 9);
  });

  it("10. chybějící ManualTimeStandard použije systémový default a přidá varování + sníží confidence", () => {
    const input = baseInput({ features: [feature({ timeBasis: "template", baseTimeMin: undefined })] });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.warnings.some((w) => w.code === "MANUAL_STANDARD_DEFAULTED")).toBe(true);
    expect(breakdown.manualDetail!.confidenceScore).toBeLessThan(1);
  });

  it("11. vyřešený tenant_standard ze contextu se použije a nesnižuje confidence za chybějící standard", () => {
    const standard = ManualTimeStandard.create({
      id: "standard:1",
      tenantId: TENANT_ID,
      operationSubtype: "cleaning",
      standardName: "Čištění",
      standardVersion: "1.0",
      source: "tenant_standard",
      baseTimeMin: 3,
      quantityBasis: "per_piece",
      validFrom: "2024-01-01T00:00:00.000Z",
      recordVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const snapshot = ManualTimeProfileSnapshot.forManualTimeStandard(standard, { createdAt: NOW });
    const input = baseInput({ features: [feature({ timeBasis: "template", baseTimeMin: undefined })] });
    const breakdown = strategy.calculate(input, baseContext({ manualTimeStandardsByFeatureId: { f1: snapshot } }));
    expect(breakdown.manualDetail?.features[0].source).toBe("tenant_standard");
    expect(breakdown.manualDetail?.warnings.some((w) => w.code === "MANUAL_STANDARD_NOT_FOUND" || w.code === "MANUAL_STANDARD_DEFAULTED")).toBe(false);
  });

  it("12. chybějící požadovaná kvalifikace operátora přidá varování a sníží confidence", () => {
    const input = baseInput({
      employeeQualificationId: "qual:basic",
      features: [feature({ employeeQualificationId: "qual:welding" })],
    });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.warnings.some((w) => w.code === "REQUIRED_QUALIFICATION_MISSING")).toBe(true);
    expect(breakdown.manualDetail!.confidenceScore).toBeLessThan(1);
  });

  it("13. neshoda workstationRequirement s workstationId přidá varování", () => {
    const input = baseInput({ workstationId: "ws:1", features: [feature({ workstationRequirement: "ws:2" })] });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.warnings.some((w) => w.code === "WORKSTATION_UNAVAILABLE")).toBe(true);
  });

  it("14. ergonomicDemand/complexityLevel zvyšují adjustedTimeMin oproti 'low'", () => {
    const low = strategy.calculate(baseInput({ features: [feature({ ergonomicDemand: "low", complexityLevel: "low" })] }), baseContext());
    const high = strategy.calculate(baseInput({ features: [feature({ ergonomicDemand: "high", complexityLevel: "high" })] }), baseContext());
    expect(high.manualDetail!.features[0].adjustedTimeMin).toBeGreaterThan(low.manualDetail!.features[0].adjustedTimeMin);
  });

  it("15. productionSeriality ovlivňuje adjustedTimeMin (single_piece pomalejší než mass_production)", () => {
    const single = strategy.calculate(baseInput({ productionSeriality: "single_piece", features: [feature()] }), baseContext());
    const mass = strategy.calculate(baseInput({ productionSeriality: "mass_production", features: [feature()] }), baseContext());
    expect(single.manualDetail!.features[0].adjustedTimeMin).toBeGreaterThan(mass.manualDetail!.features[0].adjustedTimeMin);
  });

  it("16. custom_manual podtyp přidá varování o obecném podtypu a sníží confidence", () => {
    const input = baseInput({ features: [feature({ subtype: "custom_manual" })] });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail!.confidenceScore).toBeLessThan(1);
  });

  it("17. nízká confidence vygeneruje doporučení LOW_CONFIDENCE_RESULT", () => {
    const input = baseInput({
      employeeQualificationId: "qual:none",
      features: [feature({ subtype: "custom_manual", timeBasis: "historical_average", baseTimeMin: undefined, employeeQualificationId: "qual:welding" })],
    });
    const breakdown = strategy.calculate(input, baseContext());
    if (breakdown.manualDetail!.confidenceScore < 0.6) {
      expect(breakdown.manualDetail?.recommendations.some((r) => r.code === "LOW_CONFIDENCE_RESULT")).toBe(true);
    }
  });

  it("18. percentageAllowance a fixedAllowanceMin se aplikují jako Layer 3 přirážka", () => {
    const input = baseInput({ features: [feature({ baseTimeMin: 10 })], percentageAllowance: 0.1, fixedAllowanceMin: 2 });
    const breakdown = strategy.calculate(input, baseContext());
    // rawUnitTime=10, quantity=10 => 100 batchVariable; *1.1 + 2 = 112
    expect(breakdown.manualDetail?.totalOperationTimeMin).toBeCloseTo(112, 9);
  });

  it("19. víc features se zpracují v pořadí podle 'sequence'", () => {
    const input = baseInput({
      quantity: 1,
      features: [feature({ id: "f2", sequence: 1, baseTimeMin: 2 }), feature({ id: "f1", sequence: 0, baseTimeMin: 1 })],
    });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.manualDetail?.features.map((f) => f.featureId)).toEqual(["f1", "f2"]);
  });

  it("20. repetitionCount > 1 násobí čas featuru", () => {
    const once = strategy.calculate(baseInput({ quantity: 1, features: [feature({ baseTimeMin: 3, repetitionCount: 1 })] }), baseContext());
    const thrice = strategy.calculate(baseInput({ quantity: 1, features: [feature({ baseTimeMin: 3, repetitionCount: 3 })] }), baseContext());
    expect(thrice.manualDetail!.features[0].adjustedTimeMin).toBeCloseTo(3 * once.manualDetail!.features[0].adjustedTimeMin, 9);
  });
});
