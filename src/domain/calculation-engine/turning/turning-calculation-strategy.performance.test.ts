import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { TurningCalculationStrategy } from "./turning-calculation-strategy";
import { TurningCalculationInput } from "./turning-calculation-input";
import { TurningFeature } from "./turning-feature";

/**
 * Výkonové testy (AP-MCE-001 Fáze C §21). `TurningCalculationStrategy` je
 * čistá synchronní funkce nad daty v paměti (žádné I/O) - v praxi se
 * ukazuje jako natolik rychlá, že samostatný worker adaptér NENÍ potřeba
 * (§21 "pokud je potřeba" - není). Kdyby budoucí fáze (dávkové přepočty
 * tisíců operací) tenhle rozpočet překročily, `TurningCalculationStrategy`
 * zůstává čistá funkce, kterou lze zavolat i z Web Workeru beze změny -
 * jen volající (Infrastructure/Application) by běžel jinde, doména se
 * nepřesouvá.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function context(): CalculationContext {
  return { ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }) };
}

function feature(id: string, sequence: number): TurningFeature {
  return {
    id,
    sequence,
    subtype: "external_longitudinal",
    machiningMode: "roughing",
    geometry: { startDiameterMm: 50, endDiameterMm: 46, machiningLengthMm: 100, approachLengthMm: 2, retractLengthMm: 2 },
    toolProfileId: "tool:1",
    passStrategy: { roughingDepthOfCutMm: 1 },
  };
}

function simpleInput(): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features: [feature("feature:1", 0)],
  };
}

function manyFeaturesInput(count: number): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features: Array.from({ length: count }, (_, i) => feature(`feature:${i}`, i)),
  };
}

const strategy = new TurningCalculationStrategy();

describe("TurningCalculationStrategy - výkon (AP-MCE-001 Fáze C §21)", () => {
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
    expect(breakdown.turningDetail?.features).toHaveLength(20);
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
