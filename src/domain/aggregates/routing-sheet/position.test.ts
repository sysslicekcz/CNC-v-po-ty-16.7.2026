import { describe, it, expect } from "vitest";
import { Position } from "./position";

function createPosition(): Position {
  return Position.create({ id: "pos-1", nazev: "Upnutí 1" });
}

describe("Position", () => {
  it("přidá víc Activity v pořadí přidání", () => {
    const position = createPosition();
    position.addActivity({ id: "act-1", operationTypeId: "turning", calculationType: "podelneVnejsi" });
    position.addActivity({ id: "act-2", operationTypeId: "drilling", calculationType: "vrtani" });
    expect(position.activityList.map((a) => a.id)).toEqual(["act-1", "act-2"]);
  });

  it("přesune Activity mezi dvě existující beze změny jejich sortKey", () => {
    const position = createPosition();
    position.addActivity({ id: "act-1", operationTypeId: "t1", calculationType: "c1" });
    position.addActivity({ id: "act-2", operationTypeId: "t2", calculationType: "c2" });
    position.addActivity({ id: "act-3", operationTypeId: "t3", calculationType: "c3" });

    const keyABefore = position.getActivity("act-1").sortKey.toString();
    const keyBBefore = position.getActivity("act-2").sortKey.toString();

    position.moveActivity("act-3", "act-1");

    expect(position.activityList.map((a) => a.id)).toEqual(["act-1", "act-3", "act-2"]);
    expect(position.getActivity("act-1").sortKey.toString()).toBe(keyABefore);
    expect(position.getActivity("act-2").sortKey.toString()).toBe(keyBBefore);
  });

  it("odstraní Activity", () => {
    const position = createPosition();
    position.addActivity({ id: "act-1", operationTypeId: "t1", calculationType: "c1" });
    position.removeActivity("act-1");
    expect(position.activityList).toHaveLength(0);
  });
});
