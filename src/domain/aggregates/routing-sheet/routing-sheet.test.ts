import { describe, it, expect } from "vitest";
import { RoutingSheet, RoutingSheetProps } from "./routing-sheet";
import { InvalidStateError } from "../../errors/invalid-state-error";
import { NotFoundError } from "../../errors/not-found-error";
import { ConflictError } from "../../errors/conflict-error";

function createDraft(overrides: Partial<RoutingSheetProps> = {}): RoutingSheet {
  return RoutingSheet.create({
    id: "rs-1",
    partId: "part-1",
    nazev: "Postup A",
    verze: "1",
    stav: "draft",
    createdAt: Date.now(),
    ...overrides,
  });
}

describe("RoutingSheet", () => {
  it("vytvoří draft bez operací", () => {
    const rs = createDraft();
    expect(rs.stav).toBe("draft");
    expect(rs.operationList).toHaveLength(0);
  });

  it("přidá operaci s operationNumber 10 a validním sortKey", () => {
    const rs = createDraft();
    const op = rs.addOperation({ id: "op-1", nazev: "Řezání" });
    expect(rs.operationList).toHaveLength(1);
    expect(op.operationNumber.value).toBe(10);
  });

  it("přidá víc operací se správným řazením a číslováním po desítkách", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.addOperation({ id: "op-2", nazev: "B" });
    rs.addOperation({ id: "op-3", nazev: "C" });

    expect(rs.operationList.map((o) => o.id)).toEqual(["op-1", "op-2", "op-3"]);
    expect(rs.operationList.map((o) => o.operationNumber.value)).toEqual([10, 20, 30]);
  });

  it("vloží operaci mezi dvě existující beze změny sortKey ostatních", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.addOperation({ id: "op-2", nazev: "B" });
    const keyABefore = rs.getOperation("op-1").sortKey.toString();
    const keyBBefore = rs.getOperation("op-2").sortKey.toString();

    rs.addOperation({ id: "op-3", nazev: "C" }); // vznikne na konci
    rs.reorderOperations("op-3", "op-1"); // přesune mezi op-1 a op-2

    expect(rs.operationList.map((o) => o.id)).toEqual(["op-1", "op-3", "op-2"]);
    expect(rs.getOperation("op-1").sortKey.toString()).toBe(keyABefore);
    expect(rs.getOperation("op-2").sortKey.toString()).toBe(keyBBefore);
  });

  it("odstraní operaci", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.addOperation({ id: "op-2", nazev: "B" });
    rs.removeOperation("op-1");
    expect(rs.operationList.map((o) => o.id)).toEqual(["op-2"]);
  });

  it("zakáže úpravy stromu po release", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.release(new Date());

    expect(rs.stav).toBe("released");
    expect(rs.releasedAt).toBeDefined();
    expect(() => rs.addOperation({ id: "op-2", nazev: "B" })).toThrow(InvalidStateError);
    expect(() => rs.removeOperation("op-1")).toThrow(InvalidStateError);
    expect(() => rs.reorderOperations("op-1", null)).toThrow(InvalidStateError);
  });

  it("nedovolí vydat postup, který už není draft", () => {
    const rs = createDraft();
    rs.release(new Date());
    expect(() => rs.release(new Date())).toThrow(InvalidStateError);
  });

  it("nedovolí vložit Position mimo existující Operation", () => {
    const rs = createDraft();
    expect(() => rs.addPosition("neexistuje", { id: "pos-1", nazev: "Upnutí 1" })).toThrow(NotFoundError);
  });

  it("nedovolí vložit Activity mimo existující Position", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    expect(() =>
      rs.addActivity("op-1", "neexistuje", {
        id: "act-1",
        operationTypeId: "turning",
        calculationType: "podelneVnejsi",
      })
    ).toThrow(NotFoundError);
  });

  it("nedovolí vložit Calculation mimo existující Activity", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    expect(() =>
      rs.recordCalculation("op-1", "pos-1", "neexistuje", {
        id: "calc-1",
        inputParameters: [],
        result: { rows: [], total: 0 },
        algorithmVersion: "vba-port-1",
        snapshot: {
          operationTypeId: "turning",
          operationTypeCode: "TURN",
          calculatedAt: new Date().toISOString(),
          calculationEngineVersion: "vba-port-1",
        },
      })
    ).toThrow(NotFoundError);
  });

  it("hlídá unikátnost id v rámci celého stromu", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    expect(() => rs.addOperation({ id: "op-1", nazev: "Duplicitní" })).toThrow(ConflictError);
  });

  it("hlídá unikátnost id i napříč úrovněmi (Position se stejným id jako Operation)", () => {
    const rs = createDraft();
    rs.addOperation({ id: "shared-id", nazev: "A" });
    expect(() => rs.addOperation({ id: "op-2", nazev: "B" })).not.toThrow();
    expect(() => rs.addPosition("op-2", { id: "shared-id", nazev: "Upnutí" })).toThrow(ConflictError);
  });

  it("addPosition/addActivity fungují přes plnou cestu Operation -> Position -> Activity", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });
    rs.addPosition("op-1", { id: "pos-1", nazev: "Upnutí 1" });
    rs.addActivity("op-1", "pos-1", { id: "act-1", operationTypeId: "turning", calculationType: "podelneVnejsi" });

    expect(rs.getOperation("op-1").getPosition("pos-1").getActivity("act-1").id).toBe("act-1");
  });

  it("pullEvents vyzvedne a vyprázdní nashromážděné doménové události", () => {
    const rs = createDraft();
    rs.addOperation({ id: "op-1", nazev: "A" });

    const events = rs.pullEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].aggregateId).toBe(rs.id);
    expect(rs.pullEvents()).toHaveLength(0);
  });
});
