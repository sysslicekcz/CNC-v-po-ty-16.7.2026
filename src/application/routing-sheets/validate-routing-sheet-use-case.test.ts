import { describe, it, expect } from "vitest";
import { ValidateRoutingSheetUseCase } from "./validate-routing-sheet-use-case";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";

function draft(): RoutingSheet {
  return RoutingSheet.create({
    id: "rs-1",
    tenantId: "tenant:test",
    partId: "part-1",
    nazev: "Postup A",
    verze: "1",
    stav: "draft",
    createdAt: Date.now(),
  });
}

function machine(overrides: Partial<{ id: string; status: "active" | "inactive" }> = {}): Machine {
  return Machine.create({
    id: overrides.id ?? "m-1",
    tenantId: "tenant:test",
    code: MachineCode.create("M-1"),
    name: "Stroj 1",
    hourlyRate: HourlyRate.of(1000),
    status: overrides.status ?? "active",
  });
}

function externalResource(overrides: Partial<{ id: string; status: "active" | "inactive" }> = {}): ExternalOperationResource {
  return ExternalOperationResource.create({
    id: overrides.id ?? "ext-1",
    tenantId: "tenant:test",
    code: ExternalResourceCode.create("EXT-1"),
    name: "Kooperace 1",
    status: overrides.status ?? "active",
  });
}

function operationType(overrides: Partial<{ id: string }> = {}): OperationType {
  return OperationType.create({
    id: overrides.id ?? "ot-1",
    tenantId: "tenant:test",
    kod: "podelneVnejsi",
    nazev: "Podélné vnější",
    kategorie: "turning",
    resourceRequirement: "machine",
    requiresSetupTime: true,
    requiresUnitTime: true,
    stav: "aktivni",
  });
}

describe("ValidateRoutingSheetUseCase", () => {
  const useCase = new ValidateRoutingSheetUseCase();

  it("nahlásí chybu pro prázdný postup bez operací", () => {
    const issues = useCase.execute({
      routingSheet: draft(),
      machinesById: new Map(),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("routing-sheet-empty");
    expect(issues[0].severity).toBe("error");
  });

  it("nahlásí chybu, když operace nemá přiřazený zdroj", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A" });

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map(),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues.some((i) => i.code === "operation-missing-resource" && i.severity === "error")).toBe(true);
  });

  it("nahlásí chybu, když operace odkazuje na neexistující stroj", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "neexistuje" });

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map(),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues.some((i) => i.code === "operation-unknown-machine" && i.severity === "error")).toBe(true);
  });

  it("nahlásí jen upozornění (ne chybu) pro neaktivní stroj", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    const m = machine({ status: "inactive" });

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map([[m.id, m]]),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    const issue = issues.find((i) => i.code === "operation-inactive-machine");
    expect(issue?.severity).toBe("warning");
  });

  it("nahlásí chybu pro neexistující kooperaci a upozornění pro neaktivní kooperaci", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", externalResourceId: "neexistuje" });
    const issuesUnknown = useCase.execute({
      routingSheet: rs,
      machinesById: new Map(),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issuesUnknown.some((i) => i.code === "operation-unknown-external-resource" && i.severity === "error")).toBe(true);

    const rs2 = draft();
    rs2.addOperation({ id: "op-1", nazev: "A", externalResourceId: "ext-1" });
    const ext = externalResource({ status: "inactive" });
    const issuesInactive = useCase.execute({
      routingSheet: rs2,
      machinesById: new Map(),
      externalResourcesById: new Map([[ext.id, ext]]),
      operationTypesById: new Map(),
    });
    expect(issuesInactive.find((i) => i.code === "operation-inactive-external-resource")?.severity).toBe("warning");
  });

  it("nahlásí upozornění pro chybějící kusový čas, jen když je zdroj přiřazený a finalTime je 0", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    const m = machine();

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map([[m.id, m]]),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues.some((i) => i.code === "operation-missing-time" && i.severity === "warning")).toBe(true);
  });

  it("nehlásí chybějící kusový čas, pokud je zadaný explicitní setupTimeMinutes/unitTimeMinutes", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.updateOperation("op-1", { unitTimeMinutes: 5 });
    const m = machine();

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map([[m.id, m]]),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues.some((i) => i.code === "operation-missing-time")).toBe(false);
  });

  it("nahlásí chybu pro činnost s neznámým typem operace", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "neznamy-typ", calculationType: "x" });
    const m = machine();

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map([[m.id, m]]),
      externalResourcesById: new Map(),
      operationTypesById: new Map(),
    });
    expect(issues.some((i) => i.code === "activity-unknown-operation-type" && i.severity === "error")).toBe(true);
  });

  it("nevrátí žádné nálezy pro plně validní postup", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.updateOperation("op-1", { unitTimeMinutes: 5 });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "ot-1", calculationType: "podelneVnejsi" });
    const m = machine();
    const ot = operationType();

    const issues = useCase.execute({
      routingSheet: rs,
      machinesById: new Map([[m.id, m]]),
      externalResourcesById: new Map(),
      operationTypesById: new Map([[ot.id, ot]]),
    });
    expect(issues).toHaveLength(0);
  });
});
