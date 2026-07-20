import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { CalculationBreakdown } from "./calculation-breakdown";

function baseProps() {
  return {
    rawUnitTime: Time.ofMinutes(2),
    setupTime: Time.ofMinutes(20),
    firstPieceInspectionTime: Time.ofMinutes(3),
    finalInspectionTime: Time.ofMinutes(4),
    toolChangeTime: Time.ofMinutes(1),
    fixtureChangeTime: Time.ofMinutes(0),
    handlingTime: Time.ofMinutes(0.5),
    inOperationInspectionTime: Time.ofMinutes(0),
    measurementTime: Time.ofMinutes(2),
    interOperationMoveTime: Time.zero(),
    auxiliaryTime: Time.zero(),
    waitingTime: Time.zero(),
    quantity: Quantity.ofPieces(10),
    plannedToolChanges: 0,
    plannedFixtureChanges: 0,
    operatorSkillCoefficient: 1,
    machineCoefficient: 1,
    materialCoefficient: 1,
    complexityCoefficient: 1,
    toolWearCoefficient: 1,
    historicalCalibrationCoefficient: 1,
    percentageAllowance: 0,
    fixedAllowance: Time.zero(),
  };
}

describe("CalculationBreakdown - AP-MCE-001 §03 roll-up formula", () => {
  it("bez koeficientů a přirážek: unitTimeAdjusted == rawUnitTime", () => {
    const bd = CalculationBreakdown.create(baseProps());
    expect(bd.unitTimeAdjusted.minutes).toBe(2);
  });

  it("batchVariableTime = (unitTimeAdjusted + handling + inOpInspection) * quantity + výměny", () => {
    const bd = CalculationBreakdown.create(baseProps());
    // (2 + 0.5 + 0) * 10 = 25, + 0 výměn
    expect(bd.batchVariableTime.minutes).toBeCloseTo(25);
  });

  it("batchFixedTime = setup*complexity + firstPiece + final + measurement + waiting", () => {
    const bd = CalculationBreakdown.create(baseProps());
    // 20*1 + 3 + 4 + 2 + 0 = 29
    expect(bd.batchFixedTime.minutes).toBeCloseTo(29);
  });

  it("totalOperationTimeRaw = batchFixedTime + batchVariableTime", () => {
    const bd = CalculationBreakdown.create(baseProps());
    expect(bd.totalOperationTimeRaw.minutes).toBeCloseTo(29 + 25);
  });

  it("totalOperationTime aplikuje percentageAllowance a fixedAllowance AŽ NA konci (Layer 3)", () => {
    const bd = CalculationBreakdown.create({
      ...baseProps(),
      percentageAllowance: 0.1,
      fixedAllowance: Time.ofMinutes(1),
    });
    // raw = 54, *(1.1) = 59.4, +1 = 60.4
    expect(bd.totalOperationTime.minutes).toBeCloseTo(60.4);
  });

  it("Layer 2 koeficienty se násobí mezi sebou a aplikují jen na unitTime/setupTime", () => {
    const bd = CalculationBreakdown.create({
      ...baseProps(),
      machineCoefficient: 1.1,
      materialCoefficient: 1.2,
      complexityCoefficient: 1.05,
    });
    const expectedUnit = 2 * 1.1 * 1.2 * 1.05;
    expect(bd.unitTimeAdjusted.minutes).toBeCloseTo(expectedUnit);
    // setup je ovlivněný JEN complexityCoefficient, ne machine/material
    expect(bd.batchFixedTime.minutes).toBeCloseTo(20 * 1.05 + 3 + 4 + 2 + 0);
  });

  it("výměny nástroje a upnutí se počítají jako počet × jednorázový čas výměny", () => {
    const bd = CalculationBreakdown.create({
      ...baseProps(),
      plannedToolChanges: 5,
      toolChangeTime: Time.ofMinutes(2),
      plannedFixtureChanges: 2,
      fixtureChangeTime: Time.ofMinutes(3),
    });
    // batchVariableTime = (2+0.5+0)*10 + 2*5 + 3*2 = 25 + 10 + 6 = 41
    expect(bd.batchVariableTime.minutes).toBeCloseTo(41);
  });

  it("odmítne záporný koeficient", () => {
    expect(() => CalculationBreakdown.create({ ...baseProps(), machineCoefficient: -1 })).toThrow(ValidationError);
  });

  it("odmítne neceločíselný/záporný počet výměn", () => {
    expect(() => CalculationBreakdown.create({ ...baseProps(), plannedToolChanges: -1 })).toThrow(ValidationError);
    expect(() => CalculationBreakdown.create({ ...baseProps(), plannedToolChanges: 1.5 })).toThrow(ValidationError);
  });

  it("createWithDefaults doplní koeficienty/přirážky na neutrální výchozí hodnoty", () => {
    const bd = CalculationBreakdown.createWithDefaults({
      rawUnitTime: Time.ofMinutes(2),
      setupTime: Time.ofMinutes(20),
      firstPieceInspectionTime: Time.ofMinutes(3),
      finalInspectionTime: Time.ofMinutes(4),
      toolChangeTime: Time.ofMinutes(1),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.ofMinutes(0.5),
      inOperationInspectionTime: Time.zero(),
      measurementTime: Time.ofMinutes(2),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.zero(),
      waitingTime: Time.zero(),
      quantity: Quantity.ofPieces(10),
      plannedToolChanges: 0,
      plannedFixtureChanges: 0,
    });
    expect(bd.machineCoefficient).toBe(1);
    expect(bd.percentageAllowance).toBe(0);
    expect(bd.fixedAllowance.isZero).toBe(true);
  });

  it("toJSON serializuje vstupní i odvozené hodnoty (explainability, §05)", () => {
    const bd = CalculationBreakdown.create(baseProps());
    const json = bd.toJSON();
    expect(json.rawUnitTime).toBe(2);
    expect(json.totalOperationTime).toBeCloseTo(54);
  });

  it("fromJSON(toJSON()) je round-trip - stejné odvozené hodnoty jako originál", () => {
    const original = CalculationBreakdown.create({
      ...baseProps(),
      machineCoefficient: 1.1,
      plannedToolChanges: 3,
      percentageAllowance: 0.15,
    });
    const restored = CalculationBreakdown.fromJSON(original.toJSON());
    expect(restored.totalOperationTime.minutes).toBeCloseTo(original.totalOperationTime.minutes);
    expect(restored.unitTimeAdjusted.minutes).toBeCloseTo(original.unitTimeAdjusted.minutes);
    expect(restored.quantity.pieces).toBe(original.quantity.pieces);
  });
});
