import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { CylindricalGrindingCalculationStrategy } from "./cylindrical-grinding-calculation-strategy";
import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingFeature } from "./grinding-feature";

/**
 * Výkonové testy (AP-MCE-001 Fáze E §24) - stejný důvod jako Fáze C/D:
 * `CylindricalGrindingCalculationStrategy`/`SurfaceGrindingCalculationStrategy`
 * jsou čisté synchronní funkce nad daty v paměti, worker adaptér NENÍ potřeba.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function context(): CalculationContext {
  return { ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }) };
}

function feature(id: string, sequence: number): GrindingFeature {
  return {
    id,
    sequence,
    subtype: "external_cylindrical",
    machiningMode: "roughing",
    geometry: { startDiameterMm: 50, endDiameterMm: 49.5, grindingLengthMm: 100, stockAllowanceMm: 0.25, approachLengthMm: 5, retractLengthMm: 5 },
    wheelProfileId: "wheel:1",
    passStrategy: { roughingInfeedPerPassMm: 0.05 },
  };
}

function simpleInput(): GrindingCalculationInput {
  return { operationCategory: "grinding", operationTypeId: "op-type:grinding", quantity: 10, materialId: "material:1", machineId: "machine:1", features: [feature("feature:1", 0)] };
}

function manyFeaturesInput(count: number): GrindingCalculationInput {
  return {
    operationCategory: "grinding",
    operationTypeId: "op-type:grinding",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features: Array.from({ length: count }, (_, i) => feature(`feature:${i}`, i)),
  };
}

const strategy = new CylindricalGrindingCalculationStrategy();

describe("Grinding strategies - výkon (AP-MCE-001 Fáze E §24)", () => {
  it("jedna jednoduchá operace proběhne pod 100 ms", () => {
    const ctx = context();
    const input = simpleInput();
    const start = performance.now();
    strategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("operace s 20 featury proběhne pod 100 ms", () => {
    const ctx = context();
    const input = manyFeaturesInput(20);
    const start = performance.now();
    const breakdown = strategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
    expect(breakdown.grindingDetail?.features).toHaveLength(20);
  });

  it("porovnání 20 strojů (20 nezávislých výpočtů) proběhne rychle, bez zamrznutí", () => {
    const ctx = context();
    const input = simpleInput();
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      strategy.calculate(input, ctx);
    }
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("porovnání 50 kotoučů (50 nezávislých výpočtů) proběhne rychle, bez zamrznutí", () => {
    const ctx = context();
    const input = simpleInput();
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      strategy.calculate(input, ctx);
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("dávka 500 operací proběhne v rozumném čase (dávkové zpracování, ne blokující jednotlivé volání)", () => {
    const ctx = context();
    const input = simpleInput();
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      strategy.calculate(input, ctx);
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
