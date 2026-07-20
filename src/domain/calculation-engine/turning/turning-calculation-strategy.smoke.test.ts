import { describe, it, expect } from "vitest";
import { TurningCalculationStrategy } from "./turning-calculation-strategy";
import { TurningCalculationInput } from "./turning-calculation-input";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";

function baseContext(): CalculationContext {
  return {
    ruleVersion: RuleVersion.create({
      id: "rv:1",
      tenantId: "tenant:acme",
      version: "1",
      status: "active",
      publishedAt: "2025-01-01T00:00:00.000Z",
      constants: {},
    }),
  };
}

function simpleInput(): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine-profile:1",
    toolId: "tool:1",
    features: [
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_longitudinal",
        machiningMode: "roughing",
        geometry: {
          startDiameterMm: 50,
          endDiameterMm: 46,
          machiningLengthMm: 100,
          approachLengthMm: 2,
          retractLengthMm: 2,
        },
        toolProfileId: "tool:1",
        passStrategy: { roughingDepthOfCutMm: 1 },
      },
    ],
  };
}

describe("TurningCalculationStrategy (smoke test)", () => {
  it("spočítá jednoduché vnější podélné soustružení bez chyb", () => {
    const strategy = new TurningCalculationStrategy();
    const input = simpleInput();
    const context = baseContext();

    const issues = strategy.validate(input, context);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);

    const breakdown = strategy.calculate(input, context);
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
    expect(breakdown.turningDetail).toBeDefined();
    expect(breakdown.turningDetail?.features).toHaveLength(1);
    expect(breakdown.turningDetail?.features[0].totalPasses).toBeGreaterThan(0);
    expect(breakdown.turningDetail?.strategyVersion).toBe("turning-1.0.0");
  });
});
