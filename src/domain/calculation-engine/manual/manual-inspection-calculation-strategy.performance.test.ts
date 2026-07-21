import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { ManualOperationCalculationStrategy } from "./manual-operation-calculation-strategy";
import { ManualOperationCalculationInput } from "./manual-operation-calculation-input";
import { ManualOperationFeature } from "./manual-operation-feature";
import { InspectionCalculationStrategy } from "../inspection/inspection-calculation-strategy";
import { InspectionCalculationInput } from "../inspection/inspection-calculation-input";
import { InspectionFeature } from "../inspection/inspection-feature";

/**
 * Výkonové testy Fáze F (AP-MCE-001 §24) - stejný důvod jako Fáze C/D/E:
 * `ManualOperationCalculationStrategy`/`InspectionCalculationStrategy` jsou
 * čisté synchronní funkce nad daty v paměti, worker adaptér NENÍ potřeba.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function context(): CalculationContext {
  return { ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }) };
}

function manualFeature(id: string, sequence: number): ManualOperationFeature {
  return { id, sequence, subtype: "cleaning", quantityBasis: "per_piece", timeBasis: "explicit", baseTimeMin: 1 };
}

function simpleManualInput(): ManualOperationCalculationInput {
  return { operationCategory: "manual", operationTypeId: "op-type:manual", quantity: 10, materialId: "material:1", features: [manualFeature("f:1", 0)] };
}

function manyFeaturesManualInput(count: number): ManualOperationCalculationInput {
  return {
    operationCategory: "manual",
    operationTypeId: "op-type:manual",
    quantity: 10,
    materialId: "material:1",
    features: Array.from({ length: count }, (_, i) => manualFeature(`f:${i}`, i)),
  };
}

function inspectionFeature(id: string, sequence: number): InspectionFeature {
  return { id, sequence, subtype: "dimensional_manual", inspectionLevel: "sample", measurementTimePerCharacteristicMin: 1, characteristicCount: 1 };
}

function simpleInspectionInput(): InspectionCalculationInput {
  return { operationCategory: "inspection", operationTypeId: "op-type:inspection", quantity: 10, materialId: "material:1", features: [inspectionFeature("f:1", 0)] };
}

function manyFeaturesInspectionInput(count: number): InspectionCalculationInput {
  return {
    operationCategory: "inspection",
    operationTypeId: "op-type:inspection",
    quantity: 10,
    materialId: "material:1",
    features: Array.from({ length: count }, (_, i) => inspectionFeature(`f:${i}`, i)),
  };
}

const manualStrategy = new ManualOperationCalculationStrategy();
const inspectionStrategy = new InspectionCalculationStrategy();

describe("Manual/Inspection strategie - výkon (AP-MCE-001 Fáze F §24)", () => {
  it("jednoduchá ruční operace proběhne pod 100 ms", () => {
    const ctx = context();
    const input = simpleManualInput();
    const start = performance.now();
    manualStrategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("jednoduchá kontrolní operace proběhne pod 100 ms", () => {
    const ctx = context();
    const input = simpleInspectionInput();
    const start = performance.now();
    inspectionStrategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
  });

  it("ruční operace s 50 features proběhne pod 100 ms", () => {
    const ctx = context();
    const input = manyFeaturesManualInput(50);
    const start = performance.now();
    const breakdown = manualStrategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
    expect(breakdown.manualDetail?.features).toHaveLength(50);
  });

  it("kontrolní operace s 50 features proběhne pod 100 ms", () => {
    const ctx = context();
    const input = manyFeaturesInspectionInput(50);
    const start = performance.now();
    const breakdown = inspectionStrategy.calculate(input, ctx);
    expect(performance.now() - start).toBeLessThan(100);
    expect(breakdown.inspectionDetail?.features).toHaveLength(50);
  });

  it("porovnání 50 časových standardů/metod (50 nezávislých výpočtů) proběhne rychle, bez zamrznutí", () => {
    const ctx = context();
    const manualInput = simpleManualInput();
    const inspectionInput = simpleInspectionInput();
    const start = performance.now();
    for (let i = 0; i < 25; i++) {
      manualStrategy.calculate(manualInput, ctx);
      inspectionStrategy.calculate(inspectionInput, ctx);
    }
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("dávka 500 operací proběhne v rozumném čase (dávkové zpracování, ne blokující jednotlivé volání)", () => {
    const ctx = context();
    const manualInput = simpleManualInput();
    const inspectionInput = simpleInspectionInput();
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      if (i % 2 === 0) manualStrategy.calculate(manualInput, ctx);
      else inspectionStrategy.calculate(inspectionInput, ctx);
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
