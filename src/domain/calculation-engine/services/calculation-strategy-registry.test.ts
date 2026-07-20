import { describe, it, expect } from "vitest";
import { InMemoryCalculationStrategyRegistry } from "./calculation-strategy-registry";
import { UnknownOperationCategoryError } from "../errors/calculation-error";
import { CalculationStrategy } from "./calculation-strategy";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";

function fakeStrategy(operationCategory: CalculationStrategy["operationCategory"]): CalculationStrategy {
  return {
    operationCategory,
    strategyVersion: "fake-1",
    validate: () => [],
    calculate: () =>
      CalculationBreakdown.createWithDefaults({
        rawUnitTime: Time.ofMinutes(1),
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
        quantity: Quantity.ofPieces(1),
        plannedToolChanges: 0,
        plannedFixtureChanges: 0,
      }),
  };
}

describe("InMemoryCalculationStrategyRegistry", () => {
  it("resolve() vyhodí UnknownOperationCategoryError pro nezaregistrovanou kategorii (prázdný registr Fáze A)", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    expect(() => registry.resolve("turning")).toThrow(UnknownOperationCategoryError);
  });

  it("register() + resolve() vrátí zaregistrovanou strategii", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const strategy = fakeStrategy("manual");
    registry.register(strategy);
    expect(registry.resolve("manual")).toBe(strategy);
  });

  it("has() rozliší zaregistrovanou a nezaregistrovanou kategorii", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    registry.register(fakeStrategy("manual"));
    expect(registry.has("manual")).toBe(true);
    expect(registry.has("turning")).toBe(false);
  });

  it("druhá registrace stejné kategorie přepíše první (užitečné pro testy)", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    const first = fakeStrategy("manual");
    const second = fakeStrategy("manual");
    registry.register(first);
    registry.register(second);
    expect(registry.resolve("manual")).toBe(second);
  });

  it("list() vrátí všechny zaregistrované strategie", () => {
    const registry = new InMemoryCalculationStrategyRegistry();
    registry.register(fakeStrategy("manual"));
    registry.register(fakeStrategy("inspection"));
    expect(registry.list().map((s) => s.operationCategory).sort()).toEqual(["inspection", "manual"]);
  });
});
