import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { CalculationRequest } from "./calculation-request";

function baseProps() {
  return {
    id: "calc-req:1",
    tenantId: "tenant:acme",
    operationCategory: "turning" as const,
    operationTypeId: "op-type:turning-external",
    idempotencyKey: "9e1b-idem-1",
    inputSnapshot: { quantity: 10, machineId: "machine:1" },
    ruleVersionId: "rv:2025-06-01",
    requestedAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("CalculationRequest", () => {
  it("vytvoří instanci s platnými daty", () => {
    const request = CalculationRequest.create(baseProps());
    expect(request.id).toBe("calc-req:1");
    expect(request.inputSnapshot).toEqual({ quantity: 10, machineId: "machine:1" });
  });

  it.each(["id", "tenantId", "operationTypeId", "idempotencyKey", "ruleVersionId"] as const)(
    "odmítne prázdné '%s'",
    (field) => {
      expect(() => CalculationRequest.create({ ...baseProps(), [field]: "" })).toThrow(ValidationError);
    }
  );

  it("inputSnapshot je zmrazený (immutabilita) - úprava vrácené reference nic nezmění", () => {
    const request = CalculationRequest.create(baseProps());
    expect(() => {
      (request.inputSnapshot as Record<string, unknown>).quantity = 999;
    }).toThrow();
  });

  it("requestedBy je nepovinné", () => {
    const request = CalculationRequest.create(baseProps());
    expect(request.requestedBy).toBeUndefined();
    const withUser = CalculationRequest.create({ ...baseProps(), requestedBy: "user:tech1" });
    expect(withUser.requestedBy).toBe("user:tech1");
  });
});
