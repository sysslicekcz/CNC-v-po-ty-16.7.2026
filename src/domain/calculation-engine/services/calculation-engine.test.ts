import { describe, it, expect } from "vitest";
import { DefaultCalculationEngine } from "./calculation-engine";
import { InMemoryCalculationStrategyRegistry } from "./calculation-strategy-registry";
import { CalculationStrategy } from "./calculation-strategy";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { RuleVersion } from "../rules/rule-version";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";

function trivialManualStrategy(): CalculationStrategy {
  return {
    operationCategory: "manual",
    strategyVersion: "manual-test-1",
    validate: (input) => (input.quantity <= 0 ? [{ code: "INVALID_QUANTITY", severity: "error", message: "…" }] : []),
    calculate: (input) =>
      CalculationBreakdown.createWithDefaults({
        rawUnitTime: Time.ofMinutes(2),
        setupTime: Time.zero(),
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
        quantity: Quantity.ofPieces(input.quantity),
        plannedToolChanges: 0,
        plannedFixtureChanges: 0,
      }),
  };
}

function ruleVersion(): RuleVersion {
  return RuleVersion.create({
    id: "rv:1", tenantId: "tenant:acme", version: "1", status: "active",
    publishedAt: "2025-01-01T00:00:00.000Z", constants: {},
  });
}

const baseInput: OperationCalculationInputBase = {
  operationCategory: "manual",
  operationTypeId: "op-type:deburring",
  quantity: 10,
  materialId: "material:1",
};

describe("DefaultCalculationEngine - round-trips a trivial manual operation (Fáze A acceptance)", () => {
  it("spočítá platný vstup a vrátí nezablokovaný výsledek s breakdown", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    registry.register(trivialManualStrategy());
    const engine = new DefaultCalculationEngine(registry);

    const outcome = engine.calculate(baseInput, { ruleVersion: ruleVersion() });

    expect(outcome.blocked).toBe(false);
    expect(outcome.issues).toEqual([]);
    expect(outcome.strategyVersion).toBe("manual-test-1");
    expect(outcome.breakdown).toBeDefined();
    // 10 ks × 2 min rawUnitTime, žádné koeficienty/přirážky ⇒ 20 min
    expect(outcome.breakdown!.totalOperationTime.minutes).toBeCloseTo(20);
  });

  it("nese engineVersion na instanci enginu", () => {
    const engine = new DefaultCalculationEngine(new InMemoryCalculationStrategyRegistry());
    expect(engine.engineVersion).toBe("mce-v1");
  });

  it("zablokuje výpočet, pokud validate() vrátí severity 'error' - calculate() na strategii se nezavolá", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    let calculateCalled = false;
    registry.register({
      ...trivialManualStrategy(),
      calculate: (input, context) => {
        calculateCalled = true;
        return trivialManualStrategy().calculate(input, context);
      },
    });
    const engine = new DefaultCalculationEngine(registry);

    const outcome = engine.calculate({ ...baseInput, quantity: 0 }, { ruleVersion: ruleVersion() });

    expect(outcome.blocked).toBe(true);
    expect(outcome.breakdown).toBeUndefined();
    expect(outcome.issues[0].code).toBe("INVALID_QUANTITY");
    expect(calculateCalled).toBe(false);
  });

  it("propaguje UnknownOperationCategoryError pro nezaregistrovanou kategorii (konfigurační chyba, ne warning)", () => {
    const engine = new DefaultCalculationEngine(new InMemoryCalculationStrategyRegistry());
    expect(() => engine.calculate({ ...baseInput, operationCategory: "turning" }, { ruleVersion: ruleVersion() })).toThrow();
  });
});
