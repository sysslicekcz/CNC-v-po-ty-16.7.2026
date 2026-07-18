import { describe, it, expect } from "vitest";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { routingSheetToRecordSet, routingSheetFromRecordSet } from "./routing-sheet-mapper";

function buildSampleRoutingSheet(): RoutingSheet {
  const rs = RoutingSheet.create({
    id: "rs-1",
    tenantId: "tenant:test",
    partId: "part-1",
    nazev: "Výchozí technologický postup",
    verze: "1",
    stav: "draft",
    createdAt: 1000,
  });
  rs.addOperation({ id: "op-1", nazev: "Soustružení", machineId: "machine-1" });
  rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
  rs.addActivity("op-1", "pos-1", {
    id: "act-1",
    operationTypeId: "turning",
    calculationType: "podelneVnejsi",
    toolId: "tool-1",
  });
  rs.recordCalculation("op-1", "pos-1", "act-1", {
    id: "calc-1",
    inputParameters: [{ kontura: "K1", Dc: 40, Df: 20, L: 100 }],
    result: { rows: [{ label: "Hrubování", kontura: "K1", cas: 3.2 }], total: 3.2 },
    algorithmVersion: "vba-port-1",
    snapshot: {
      machineId: "machine-1",
      machineName: "PUMA 700",
      operationTypeId: "turning",
      operationTypeCode: "TURN",
      calculatedAt: "2026-01-01T00:00:00.000Z",
      calculationEngineVersion: "vba-port-1",
    },
  });
  return rs;
}

describe("routing-sheet-mapper", () => {
  it("round-trip zachová strukturu stromu a pořadí", () => {
    const original = buildSampleRoutingSheet();
    const recordSet = routingSheetToRecordSet(original);
    const restored = routingSheetFromRecordSet(recordSet);

    expect(restored.id).toBe(original.id);
    expect(restored.operationList.map((o) => o.id)).toEqual(original.operationList.map((o) => o.id));
    expect(restored.operationList[0].positionList.map((p) => p.id)).toEqual(
      original.operationList[0].positionList.map((p) => p.id)
    );
    expect(restored.operationList[0].positionList[0].activityList.map((a) => a.id)).toEqual(
      original.operationList[0].positionList[0].activityList.map((a) => a.id)
    );
  });

  it("round-trip zachová Calculation vč. snapshotu", () => {
    const original = buildSampleRoutingSheet();
    const recordSet = routingSheetToRecordSet(original);
    const restored = routingSheetFromRecordSet(recordSet);

    const originalCalc = original.operationList[0].positionList[0].activityList[0].calculation;
    const restoredCalc = restored.operationList[0].positionList[0].activityList[0].calculation;

    expect(restoredCalc).toBeDefined();
    expect(restoredCalc?.result.total).toBe(originalCalc?.result.total);
    expect(restoredCalc?.snapshot).toEqual(originalCalc?.snapshot);
    expect(restoredCalc?.algorithmVersion).toBe(originalCalc?.algorithmVersion);
  });

  it("chybějící volitelná pole se po round-tripu načtou jako undefined, ne jako chyba", () => {
    const rs = RoutingSheet.create({
      id: "rs-2",
      tenantId: "tenant:test",
      partId: "part-2",
      nazev: "Minimální postup",
      verze: "1",
      stav: "draft",
      createdAt: 1000,
    });
    rs.addOperation({ id: "op-1", nazev: "Kontrola" }); // bez machineId
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", {
      id: "act-1",
      operationTypeId: "inspection",
      calculationType: "vizualni-kontrola",
      kind: "inspection",
    }); // bez toolId, bez Calculation

    const restored = routingSheetFromRecordSet(routingSheetToRecordSet(rs));
    const operation = restored.operationList[0];
    const activity = operation.positionList[0].activityList[0];

    expect(operation.machineId).toBeUndefined();
    expect(activity.toolId).toBeUndefined();
    expect(activity.calculation).toBeUndefined();
  });

  it("neplatná perzistovaná data (např. neplatný stav) vyhodí chybu, ne tichý fallback", () => {
    const rs = buildSampleRoutingSheet();
    const recordSet = routingSheetToRecordSet(rs);
    recordSet.routingSheet.stav = "neexistujici-stav";

    expect(() => routingSheetFromRecordSet(recordSet)).toThrow();
  });
});
