import { describe, it, expect, beforeEach } from "vitest";
import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { IndexedDbRoutingSheetRepository } from "./indexeddb-routing-sheet-repository";
import { deleteTpvDbForTests } from "../tpv-db";

function buildRoutingSheet(id: string, partId: string): RoutingSheet {
  const rs = RoutingSheet.create({
    id,
    partId,
    nazev: "Výchozí technologický postup",
    verze: "1",
    stav: "draft",
    createdAt: 1000,
  });
  rs.addOperation({ id: `${id}-op-1`, nazev: "Řezání" });
  rs.addOperation({ id: `${id}-op-2`, nazev: "Soustružení", machineId: "machine-1" });
  rs.addPosition(`${id}-op-2`, { id: `${id}-pos-1`, nazev: "Upnutí 1" });
  rs.addActivity(`${id}-op-2`, `${id}-pos-1`, {
    id: `${id}-act-1`,
    operationTypeId: "turning",
    calculationType: "podelneVnejsi",
  });
  rs.addActivity(`${id}-op-2`, `${id}-pos-1`, {
    id: `${id}-act-2`,
    operationTypeId: "drilling",
    calculationType: "vrtani",
  });
  rs.recordCalculation(`${id}-op-2`, `${id}-pos-1`, `${id}-act-1`, {
    id: `${id}-calc-1`,
    inputParameters: [{ kontura: "K1", Dc: 40, Df: 20, L: 100 }],
    result: { rows: [], total: 2.5 },
    algorithmVersion: "vba-port-1",
    snapshot: {
      operationTypeId: "turning",
      operationTypeCode: "TURN",
      calculatedAt: "2026-01-01T00:00:00.000Z",
      calculationEngineVersion: "vba-port-1",
    },
  });
  return rs;
}

describe("IndexedDbRoutingSheetRepository", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("uloží a znovu načte celý strom", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const original = buildRoutingSheet("rs-a", "part-a");
    await repo.save(original);

    const loaded = await repo.findById("rs-a");
    expect(loaded).not.toBeNull();
    expect(loaded!.operationList).toHaveLength(2);
    expect(loaded!.operationList[1].positionList[0].activityList).toHaveLength(2);
  });

  it("zachová pořadí operací/upnutí/činností", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const original = buildRoutingSheet("rs-b", "part-b");
    await repo.save(original);

    const loaded = await repo.findById("rs-b");
    expect(loaded!.operationList.map((o) => o.id)).toEqual(["rs-b-op-1", "rs-b-op-2"]);
    expect(loaded!.operationList[1].positionList[0].activityList.map((a) => a.id)).toEqual([
      "rs-b-act-1",
      "rs-b-act-2",
    ]);
  });

  it("zachová Calculation", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const original = buildRoutingSheet("rs-c", "part-c");
    await repo.save(original);

    const loaded = await repo.findById("rs-c");
    const activity = loaded!.operationList[1].positionList[0].activityList[0];
    expect(activity.calculation).toBeDefined();
    expect(activity.calculation!.finalTime).toBe(2.5);
  });

  it("při opětovném uložení po odstranění Activity smaže odpovídající record", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const original = buildRoutingSheet("rs-d", "part-d");
    await repo.save(original);

    const loaded = await repo.findById("rs-d");
    loaded!.removeActivity("rs-d-op-2", "rs-d-pos-1", "rs-d-act-2");
    await repo.save(loaded!);

    const reloaded = await repo.findById("rs-d");
    expect(reloaded!.operationList[1].positionList[0].activityList.map((a) => a.id)).toEqual(["rs-d-act-1"]);
  });

  it("neodstraní Activity jiné RoutingSheet", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    const rsE = buildRoutingSheet("rs-e", "part-e");
    const rsF = buildRoutingSheet("rs-f", "part-f");
    await repo.save(rsE);
    await repo.save(rsF);

    const loadedE = await repo.findById("rs-e");
    loadedE!.removeActivity("rs-e-op-2", "rs-e-pos-1", "rs-e-act-2");
    await repo.save(loadedE!);

    const reloadedF = await repo.findById("rs-f");
    expect(reloadedF!.operationList[1].positionList[0].activityList).toHaveLength(2);
  });

  it("findByPartId vrátí jen postupy daného dílu", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    await repo.save(buildRoutingSheet("rs-g", "part-shared"));
    await repo.save(buildRoutingSheet("rs-h", "part-other"));

    const forShared = await repo.findByPartId("part-shared");
    expect(forShared.map((rs) => rs.id)).toEqual(["rs-g"]);
  });

  it("delete odstraní celý strom", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    await repo.save(buildRoutingSheet("rs-i", "part-i"));
    await repo.delete("rs-i");

    expect(await repo.findById("rs-i")).toBeNull();
  });

  it("findById vrací null pro neexistující id", async () => {
    const repo = new IndexedDbRoutingSheetRepository();
    expect(await repo.findById("neexistuje")).toBeNull();
  });
});
