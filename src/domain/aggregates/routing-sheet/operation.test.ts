import { describe, it, expect } from "vitest";
import { Operation } from "./operation";
import { SortKey } from "../../value-objects/sort-key";
import { OperationNumber } from "../../value-objects/operation-number";

function createOperation(): Operation {
  return Operation.create({
    id: "op-1",
    operationNumber: OperationNumber.create(10),
    sortKey: SortKey.initial(),
    nazev: "Hrubovací soustružení",
    stav: "aktivni",
  });
}

describe("Operation", () => {
  it("nemá stroj, dokud se nepřiřadí", () => {
    const operation = createOperation();
    expect(operation.machineId).toBeUndefined();
  });

  it("přiřadí stroj", () => {
    const operation = createOperation();
    operation.assignMachine("machine-1");
    expect(operation.machineId).toBe("machine-1");
  });

  it("umožní stroj i odebrat", () => {
    const operation = createOperation();
    operation.assignMachine("machine-1");
    operation.assignMachine(undefined);
    expect(operation.machineId).toBeUndefined();
  });

  it("přidá víc Position", () => {
    const operation = createOperation();
    operation.addPosition({ id: "pos-1", nazev: "Upnutí 1" });
    operation.addPosition({ id: "pos-2", nazev: "Upnutí 2" });
    expect(operation.positionList.map((p) => p.id)).toEqual(["pos-1", "pos-2"]);
  });

  it("odstraní Position", () => {
    const operation = createOperation();
    operation.addPosition({ id: "pos-1", nazev: "Upnutí 1" });
    operation.addPosition({ id: "pos-2", nazev: "Upnutí 2" });
    operation.removePosition("pos-1");
    expect(operation.positionList.map((p) => p.id)).toEqual(["pos-2"]);
  });

  it("OperationNumber je nezávislé na SortKey - přečíslování nemění řazení", () => {
    const operation = createOperation();
    const sortKeyBefore = operation.sortKey.toString();
    operation.setOperationNumber(OperationNumber.next(operation.operationNumber));
    expect(operation.operationNumber.value).toBe(20);
    expect(operation.sortKey.toString()).toBe(sortKeyBefore);
  });
});
