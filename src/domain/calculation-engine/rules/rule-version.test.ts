import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { RuleVersion } from "./rule-version";

describe("RuleVersion", () => {
  it("vytvoří instanci a zmrazí 'constants'", () => {
    const rv = RuleVersion.create({
      id: "rv:1",
      tenantId: "tenant:acme",
      version: "2025-06-01",
      status: "active",
      publishedAt: "2025-06-01T00:00:00.000Z",
      constants: { "default.percentageAllowance": 0.1 },
    });
    expect(rv.getConstant("default.percentageAllowance", 0)).toBeCloseTo(0.1);
    expect(() => {
      (rv.constants as Record<string, number>)["default.percentageAllowance"] = 0.5;
    }).toThrow();
  });

  it("getConstant vrátí fallback pro neznámý klíč", () => {
    const rv = RuleVersion.create({
      id: "rv:1", tenantId: "tenant:acme", version: "1", status: "draft",
      publishedAt: "2025-01-01T00:00:00.000Z", constants: {},
    });
    expect(rv.getConstant("unknown.key", 42)).toBe(42);
  });

  it("odmítne prázdné id/tenantId/version", () => {
    const base = { id: "rv:1", tenantId: "t", version: "1", status: "draft" as const, publishedAt: "2025-01-01T00:00:00.000Z", constants: {} };
    expect(() => RuleVersion.create({ ...base, id: "" })).toThrow(ValidationError);
    expect(() => RuleVersion.create({ ...base, tenantId: "" })).toThrow(ValidationError);
    expect(() => RuleVersion.create({ ...base, version: "" })).toThrow(ValidationError);
  });
});
