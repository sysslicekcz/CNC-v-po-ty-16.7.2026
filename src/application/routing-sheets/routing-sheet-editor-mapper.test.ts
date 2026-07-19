import { describe, it, expect } from "vitest";
import { toRoutingSheetEditorDto, RoutingSheetEditorLookups } from "./routing-sheet-editor-mapper";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Part } from "@/domain/entities/part";
import { Quantity } from "@/domain/value-objects/quantity";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
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

function part(): Part {
  return Part.create({ id: "part-1", orderId: "order-1", nazev: "Díl A", mnozstvi: Quantity.of(1, "ks"), cisloVykresu: "V-1" });
}

function machine(id: string, status: "active" | "inactive" = "active"): Machine {
  return Machine.create({
    id,
    tenantId: "tenant:test",
    code: MachineCode.create(id.toUpperCase()),
    name: `Stroj ${id}`,
    hourlyRate: HourlyRate.of(1000),
    status,
  });
}

function emptyLookups(): RoutingSheetEditorLookups {
  return { machinesById: new Map(), externalResourcesById: new Map(), operationTypesById: new Map(), toolsById: new Map() };
}

describe("toRoutingSheetEditorDto", () => {
  it("namapuje základní hlavičku postupu", () => {
    const rs = draft();
    const dto = toRoutingSheetEditorDto(rs, part(), emptyLookups());

    expect(dto.id).toBe("rs-1");
    expect(dto.revision).toBe(1);
    expect(dto.status).toBe("draft");
    expect(dto.partNumber).toBe("V-1");
    expect(dto.operations).toHaveLength(0);
    expect(dto.dirty).toBe(false);
  });

  it("dosadí kód/název stroje z lookups a označí neaktivní stroj", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    const m = machine("m-1", "inactive");
    const lookups = { ...emptyLookups(), machinesById: new Map([[m.id, m]]) };

    const dto = toRoutingSheetEditorDto(rs, part(), lookups);
    const op = dto.operations[0];
    expect(op.resourceType).toBe("machine");
    expect(op.machineCode).toBe("M-1");
    expect(op.machineInactive).toBe(true);
  });

  it("machineInactive je true, i když se stroj v lookups vůbec nenajde (smazaný/cizí tenant)", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "neexistuje" });

    const dto = toRoutingSheetEditorDto(rs, part(), emptyLookups());
    expect(dto.operations[0].machineInactive).toBe(true);
    expect(dto.operations[0].machineCode).toBeUndefined();
  });

  it("nedetekuje zastaralost kalkulace, pokud se stroj/nástroj od výpočtu nezměnil", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "ot-1", calculationType: "podelneVnejsi" });
    rs.recordCalculation("op-1", "pos-1", "act-1", {
      id: "calc-1",
      inputParameters: [],
      result: { rows: [], total: 5 },
      algorithmVersion: "vba-port-1",
      snapshot: { operationTypeId: "ot-1", operationTypeCode: "podelneVnejsi", machineId: "m-1", calculatedAt: new Date().toISOString(), calculationEngineVersion: "vba-port-1" },
    });

    const dto = toRoutingSheetEditorDto(rs, part(), emptyLookups());
    const activity = dto.operations[0].positions[0].activities[0];
    expect(activity.timeMinutes).toBe(5);
    expect(activity.calculationStaleByResourceChange).toBe(false);
  });

  it("detekuje zastaralost kalkulace po změně stroje operace", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "ot-1", calculationType: "podelneVnejsi" });
    rs.recordCalculation("op-1", "pos-1", "act-1", {
      id: "calc-1",
      inputParameters: [],
      result: { rows: [], total: 5 },
      algorithmVersion: "vba-port-1",
      snapshot: { operationTypeId: "ot-1", operationTypeCode: "podelneVnejsi", machineId: "m-1", calculatedAt: new Date().toISOString(), calculationEngineVersion: "vba-port-1" },
    });

    rs.assignResourceToOperation("op-1", { type: "machine", machineId: "m-2" }); // jiný stroj -> kalkulace zastarala

    const dto = toRoutingSheetEditorDto(rs, part(), emptyLookups());
    expect(dto.operations[0].positions[0].activities[0].calculationStaleByResourceChange).toBe(true);
  });

  it("detekuje zastaralost kalkulace po změně nástroje činnosti", () => {
    const rs = draft();
    rs.addOperation({ id: "op-1", nazev: "A", machineId: "m-1" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "ot-1", calculationType: "podelneVnejsi", toolId: "tool-1" });
    rs.recordCalculation("op-1", "pos-1", "act-1", {
      id: "calc-1",
      inputParameters: [],
      result: { rows: [], total: 5 },
      algorithmVersion: "vba-port-1",
      snapshot: {
        operationTypeId: "ot-1",
        operationTypeCode: "podelneVnejsi",
        machineId: "m-1",
        toolId: "tool-1",
        calculatedAt: new Date().toISOString(),
        calculationEngineVersion: "vba-port-1",
      },
    });

    rs.getOperation("op-1").getPosition("pos-1").getActivity("act-1").assignTool("tool-2");

    const dto = toRoutingSheetEditorDto(rs, part(), emptyLookups());
    expect(dto.operations[0].positions[0].activities[0].calculationStaleByResourceChange).toBe(true);
  });
});
