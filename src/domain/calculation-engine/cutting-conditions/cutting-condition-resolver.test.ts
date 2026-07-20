import { describe, it, expect } from "vitest";
import { CuttingSpeed } from "../value-objects/cutting-speed";
import { FeedRate } from "../value-objects/feed-rate";
import { CuttingCondition } from "./cutting-condition";
import { resolveCuttingConditions, ResolveCuttingConditionsRequest, ResolveCuttingConditionsCandidates } from "./cutting-condition-resolver";

function baseRequest(overrides: Partial<ResolveCuttingConditionsRequest> = {}): ResolveCuttingConditionsRequest {
  return {
    materialProfileId: "material:1", machineProfileId: "machine-profile:1", toolProfileId: "tool:1",
    operationCategory: "turning", feedUnit: "mm_per_rev",
    ...overrides,
  };
}

function condition(overrides: Partial<Parameters<typeof CuttingCondition.create>[0]> = {}) {
  return CuttingCondition.create({
    id: "cc:1", tenantId: "tenant:acme", materialProfileId: "material:1", operationCategory: "turning",
    source: "tool_machine_material", priority: 0, confidence: 0.8, ruleVersion: "rv:1", validFrom: "2025-01-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("resolveCuttingConditions - Scénář 13: resolver použije explicitní řezné podmínky", () => {
  it("explicitní hodnota vyhraje nad vším ostatním", () => {
    const explicitSpeed = CuttingSpeed.ofMetersPerMinute(999);
    const result = resolveCuttingConditions(
      baseRequest({ explicitValues: { cuttingSpeed: explicitSpeed } }),
      {
        candidates: [condition({ cuttingSpeed: CuttingSpeed.ofMetersPerMinute(100), toolProfileId: "tool:1", machineProfileId: "machine-profile:1", source: "tenant_approved" })],
      }
    );
    expect(result.cuttingSpeed?.value.metersPerMinute).toBe(999);
    expect(result.cuttingSpeed?.source).toBe("explicit");
  });
});

describe("resolveCuttingConditions - Scénář 14: resolver použije tenant (schválené) podmínky", () => {
  it("bez explicitní hodnoty vyhraje 'tenant_approved' nad obecnou kombinací nástroj+stroj+materiál", () => {
    const candidates: ResolveCuttingConditionsCandidates = {
      candidates: [
        condition({ id: "cc:generic", cuttingSpeed: CuttingSpeed.ofMetersPerMinute(80), source: "tool_machine_material", toolProfileId: "tool:1", machineProfileId: "machine-profile:1" }),
        condition({ id: "cc:approved", cuttingSpeed: CuttingSpeed.ofMetersPerMinute(120), source: "tenant_approved", toolProfileId: "tool:1", machineProfileId: "machine-profile:1" }),
      ],
    };
    const result = resolveCuttingConditions(baseRequest(), candidates);
    expect(result.cuttingSpeed?.value.metersPerMinute).toBe(120);
    expect(result.cuttingSpeed?.source).toBe("tenant_approved");
    expect(result.cuttingSpeed?.sourceRecordId).toBe("cc:approved");
  });
});

describe("resolveCuttingConditions - Scénář 15: resolver použije systémové defaulty", () => {
  it("bez kandidátů/profilů vyhraje systémová výchozí hodnota", () => {
    const result = resolveCuttingConditions(baseRequest(), {
      candidates: [],
      systemDefault: condition({ id: "cc:default", cuttingSpeed: CuttingSpeed.ofMetersPerMinute(60), source: "system_default", confidence: 0.5 }),
    });
    expect(result.cuttingSpeed?.value.metersPerMinute).toBe(60);
    expect(result.cuttingSpeed?.source).toBe("system_default");
  });

  it("úroveň 7: úplně bez dat vrátí warning, ne vyhozenou výjimku", () => {
    const result = resolveCuttingConditions(baseRequest(), { candidates: [] });
    expect(result.cuttingSpeed).toBeUndefined();
    expect(result.issues.some((i) => i.code === "MISSING_CUTTING_SPEED")).toBe(true);
    expect(result.issues.every((i) => i.severity === "warning")).toBe(true);
  });
});

describe("resolveCuttingConditions - priorita specifičnosti mezi kandidáty", () => {
  it("kombinace s konkrétním nástrojem+strojem vyhraje nad obecnější (bez feedUnit shody)", () => {
    const feed = FeedRate.of(0.2, "mm_per_rev");
    const result = resolveCuttingConditions(baseRequest(), {
      candidates: [
        condition({ id: "cc:less-specific", feedPerRevolution: FeedRate.of(0.1, "mm_per_rev"), source: "tool_machine_material" }),
        condition({ id: "cc:specific", feedPerRevolution: feed, toolProfileId: "tool:1", machineProfileId: "machine-profile:1", source: "tool_machine_material" }),
      ],
    });
    expect(result.feed?.value.value).toBe(0.2);
  });
});
