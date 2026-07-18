import { describe, it, expect } from "vitest";
import { Activity, RecordCalculationInput } from "./activity";
import { SortKey } from "../../value-objects/sort-key";

function createActivity(kind: "calculation" | "manual" = "calculation"): Activity {
  return Activity.create({
    id: "act-1",
    operationTypeId: "turning",
    calculationType: kind === "calculation" ? "podelneVnejsi" : "vizualni-kontrola",
    sortKey: SortKey.initial(),
    kind,
    stav: "aktivni",
  });
}

function calculationInput(overrides: Partial<RecordCalculationInput> = {}): RecordCalculationInput {
  return {
    id: "calc-1",
    inputParameters: [{ kontura: "K1", Dc: 20, Df: 10, L: 50 }],
    result: { rows: [], total: 3.5 },
    algorithmVersion: "vba-port-1",
    snapshot: {
      operationTypeId: "turning",
      operationTypeCode: "TURN",
      calculatedAt: new Date().toISOString(),
      calculationEngineVersion: "vba-port-1",
    },
    ...overrides,
  };
}

describe("Activity", () => {
  it("přiřadí nástroj", () => {
    const activity = createActivity();
    activity.assignTool("tool-1");
    expect(activity.toolId).toBe("tool-1");
  });

  it("existuje bez Calculation (kind: manual - kontrola/NDT/odjehlení bez výpočtu)", () => {
    const activity = createActivity("manual");
    expect(activity.calculation).toBeUndefined();
    expect(activity.kind).toBe("manual");
  });

  it("uloží Calculation", () => {
    const activity = createActivity();
    const calc = activity.recordCalculation(calculationInput());
    expect(activity.calculation).toBe(calc);
    expect(activity.calculation?.finalTime).toBe(3.5);
  });

  it("Calculation je po vytvoření immutable - snapshot je zmrazený", () => {
    const activity = createActivity();
    const calc = activity.recordCalculation(calculationInput());
    expect(Object.isFrozen(calc.snapshot)).toBe(true);
    expect(() => {
      (calc.snapshot as { operationTypeCode: string }).operationTypeCode = "HACKED";
    }).toThrow(TypeError);
    expect(calc.snapshot.operationTypeCode).toBe("TURN");
  });

  it("applyManualCorrection nahradí Calculation novou instancí, nemutuje starou", () => {
    const activity = createActivity();
    const first = activity.recordCalculation(calculationInput());
    const corrected = activity.applyManualCorrection(4);

    expect(corrected).not.toBe(first);
    expect(first.manualCorrection).toBeUndefined();
    expect(first.finalTime).toBe(3.5); // stará instance zůstává beze změny
    expect(corrected.manualCorrection).toBe(4);
    expect(corrected.finalTime).toBe(4);
    expect(activity.calculation).toBe(corrected);
  });

  it("applyManualCorrection bez existujícího výpočtu vyhodí chybu", () => {
    const activity = createActivity();
    expect(() => activity.applyManualCorrection(4)).toThrow();
  });
});
