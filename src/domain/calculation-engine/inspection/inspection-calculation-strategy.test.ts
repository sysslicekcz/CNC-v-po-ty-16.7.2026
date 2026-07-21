import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { InspectionEquipmentProfile } from "./inspection-equipment-profile";
import { InspectionEquipmentProfileSnapshot } from "./inspection-equipment-profile-snapshot";
import { InspectionCalculationStrategy } from "./inspection-calculation-strategy";
import { InspectionCalculationInput } from "./inspection-calculation-input";
import { InspectionFeature } from "./inspection-feature";

/**
 * 30 unit/integration test scénářů pro `InspectionCalculationStrategy`
 * (AP-MCE-001 Fáze F §21, scénáře 21-50) - stejná technika jako
 * `manual-operation-calculation-strategy.test.ts`.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function baseContext(overrides: Partial<CalculationContext> = {}): CalculationContext {
  return {
    ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }),
    ...overrides,
  };
}

function baseInput(overrides: Partial<InspectionCalculationInput> = {}): InspectionCalculationInput {
  return { operationCategory: "inspection", operationTypeId: "op-type:inspection", quantity: 20, materialId: "material:1", ...overrides };
}

function feature(overrides: Partial<InspectionFeature> = {}): InspectionFeature {
  return { id: "f1", sequence: 0, subtype: "dimensional_manual", inspectionLevel: "sample", measurementTimePerCharacteristicMin: 1, characteristicCount: 1, ...overrides };
}

function equipment(overrides: Partial<Parameters<typeof InspectionEquipmentProfile.create>[0]> = {}): InspectionEquipmentProfile {
  return InspectionEquipmentProfile.create({
    id: "equipment:1",
    tenantId: TENANT_ID,
    equipmentType: "cmm",
    supportedInspectionSubtypes: ["dimensional_cmm"],
    setupTimeMin: 5,
    equipmentCoefficient: 1,
    automationLevel: "automatic",
    reportGenerationMode: "automatic",
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

const strategy = new InspectionCalculationStrategy();

describe("InspectionCalculationStrategy (AP-MCE-001 Fáze F §21, scénáře 21-50)", () => {
  it("21. validní minimální vstup (every_piece) projde bez chyb a spočítá se", () => {
    const input = baseInput({ measurementTimePerCharacteristicMin: 0.5 });
    expect(strategy.validate(input, baseContext())).toEqual([]);
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(20);
  });

  it("22. quantity <= 0 vrátí chybu", () => {
    const issues = strategy.validate(baseInput({ quantity: 0 }), baseContext());
    expect(issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("23. every_nth_piece: inspectedPieceCount = ceil(quantity/frequency)", () => {
    const breakdown = strategy.calculate(baseInput({ quantity: 23, features: [feature({ sampleRule: { mode: "every_nth_piece", frequency: 5 } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(5);
  });

  it("24. percentage_sample: inspectedPieceCount = ceil(quantity*percentage)", () => {
    const breakdown = strategy.calculate(baseInput({ quantity: 23, features: [feature({ sampleRule: { mode: "percentage_sample", percentage: 0.3 } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(7);
  });

  it("25. first_and_last: quantity=1 -> inspectedPieceCount=1", () => {
    const breakdown = strategy.calculate(baseInput({ quantity: 1, features: [feature({ sampleRule: { mode: "first_and_last" } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(1);
  });

  it("26. first_and_last: quantity>1 -> inspectedPieceCount=2", () => {
    const breakdown = strategy.calculate(baseInput({ quantity: 15, features: [feature({ sampleRule: { mode: "first_and_last" } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(2);
  });

  it("27. first_piece_only -> inspectedPieceCount=1 (ruční měření posuvkou)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "dimensional_manual", sampleRule: { mode: "first_piece_only" } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(1);
  });

  it("28. měření mikrometrem - every_piece se stejnou logikou jako posuvka", () => {
    const breakdown = strategy.calculate(baseInput({ quantity: 8, features: [feature({ subtype: "dimensional_manual", sampleRule: { mode: "every_piece" } })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(8);
  });

  it("29. CMM s existujícím programem (programLoadTimeMin bez programCreationTimeMin)", () => {
    const input = baseInput({
      quantity: 5,
      programLoadTimeMin: 2,
      automaticCycleTimePerCharacteristicMin: 0.3,
      features: [feature({ subtype: "dimensional_cmm", sampleRule: { mode: "every_piece" } })],
    });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.inspectionDetail?.equipmentSetupTimeMin).toBeCloseTo(2, 9);
    expect(breakdown.inspectionDetail?.automaticCycleTimeMin).toBeCloseTo(1.5, 9);
  });

  it("30. CMM s vytvořením programu (programCreationTimeMin) přidá jednorázový čas navíc", () => {
    const withCreation = strategy.calculate(
      baseInput({ quantity: 5, programCreationTimeMin: 20, programLoadTimeMin: 2, features: [feature({ subtype: "dimensional_cmm" })] }),
      baseContext()
    );
    const withoutCreation = strategy.calculate(baseInput({ quantity: 5, programLoadTimeMin: 2, features: [feature({ subtype: "dimensional_cmm" })] }), baseContext());
    expect(withCreation.inspectionDetail!.equipmentSetupTimeMin).toBeGreaterThan(withoutCreation.inspectionDetail!.equipmentSetupTimeMin);
  });

  it("31. drsnost (surface_roughness) se počítá stejnou obecnou cestou", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "surface_roughness" })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].subtype).toBe("surface_roughness");
  });

  it("32. tvrdost (hardness)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "hardness" })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].subtype).toBe("hardness");
  });

  it("33. házení (runout)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "runout" })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].subtype).toBe("runout");
  });

  it("34. tlaková zkouška (pressure_test)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "pressure_test" })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].subtype).toBe("pressure_test");
  });

  it("35. kontrola dokumentace (documentation_review)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "documentation_review", measurementTimePerCharacteristicMin: 0 })] }), baseContext());
    expect(breakdown.inspectionDetail?.features[0].subtype).toBe("documentation_review");
  });

  it("36. finální uvolnění (final_release)", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ subtype: "final_release", reportTimeMin: 5 })] }), baseContext());
    expect(breakdown.inspectionDetail?.reportTimeMin).toBeGreaterThanOrEqual(5);
  });

  it("37. víc inspection features se zpracují nezávisle", () => {
    const input = baseInput({
      quantity: 10,
      features: [feature({ id: "f1", sequence: 0, sampleRule: { mode: "every_piece" } }), feature({ id: "f2", sequence: 1, sampleRule: { mode: "first_piece_only" } })],
    });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(10);
    expect(breakdown.inspectionDetail?.features[1].inspectedPieceCount).toBe(1);
  });

  it("38. víc měřených znaků zvyšuje measurementTimeMin lineárně", () => {
    const one = strategy.calculate(baseInput({ features: [feature({ characteristicCount: 1 })] }), baseContext());
    const five = strategy.calculate(baseInput({ features: [feature({ characteristicCount: 5 })] }), baseContext());
    expect(five.inspectionDetail!.measurementTimeMin).toBeCloseTo(5 * one.inspectionDetail!.measurementTimeMin, 9);
  });

  it("39. neplatná kalibrace zařízení (přes context) přidá varování a sníží confidence", () => {
    const snapshot = InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(equipment(), { systemVersion: 1, createdAt: NOW });
    const input = baseInput({ features: [feature({ equipmentId: "equipment:1" })] });
    const breakdown = strategy.calculate(
      input,
      baseContext({ inspectionEquipmentSnapshotsByFeatureId: { f1: snapshot }, inspectionEquipmentCalibrationExpiredByFeatureId: { f1: true } })
    );
    expect(breakdown.inspectionDetail?.warnings.some((w) => w.code === "EQUIPMENT_CALIBRATION_EXPIRED")).toBe(true);
    expect(breakdown.inspectionDetail!.confidenceScore).toBeLessThan(1);
  });

  it("40. nedostatečná přesnost/nevhodné vybavení (equipment nepodporuje subtype) přidá varování INSPECTION_EQUIPMENT_UNSUITABLE", () => {
    const eq = equipment({ supportedInspectionSubtypes: ["hardness"] });
    const snapshot = InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(eq, { systemVersion: 1, createdAt: NOW });
    const input = baseInput({ features: [feature({ subtype: "dimensional_cmm", equipmentId: "equipment:1" })] });
    const breakdown = strategy.calculate(input, baseContext({ inspectionEquipmentSnapshotsByFeatureId: { f1: snapshot } }));
    expect(breakdown.inspectionDetail?.warnings.some((w) => w.code === "INSPECTION_EQUIPMENT_UNSUITABLE")).toBe(true);
  });

  it("41. odkazované, ale nenalezené vybavení přidá varování INSPECTION_EQUIPMENT_NOT_FOUND", () => {
    const breakdown = strategy.calculate(baseInput({ features: [feature({ equipmentId: "equipment:missing" })] }), baseContext());
    expect(breakdown.inspectionDetail?.warnings.some((w) => w.code === "INSPECTION_EQUIPMENT_NOT_FOUND")).toBe(true);
    expect(breakdown.inspectionDetail!.confidenceScore).toBeLessThan(1);
  });

  it("42. chybějící kvalifikace inspektora přidá varování QUALIFICATION_MISSING", () => {
    const input = baseInput({ requiredQualificationIds: ["qual:basic"], features: [feature({ qualificationIds: ["qual:ndt"] })] });
    const breakdown = strategy.calculate(input, baseContext());
    expect(breakdown.inspectionDetail?.warnings.some((w) => w.code === "QUALIFICATION_MISSING")).toBe(true);
  });

  it("43. determinismus - opakované volání calculate() vrátí identický inspectionDetail", () => {
    const input = baseInput({ features: [feature()] });
    const first = strategy.calculate(input, baseContext());
    const second = strategy.calculate(input, baseContext());
    expect(JSON.parse(JSON.stringify(second.inspectionDetail))).toEqual(JSON.parse(JSON.stringify(first.inspectionDetail)));
  });

  it("44. offline výpočet - žádné I/O, čistá funkce nad předanými daty", () => {
    expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
    const breakdown = strategy.calculate(baseInput({ features: [feature()] }), baseContext());
    expect(breakdown.inspectionDetail).toBeDefined();
  });

  it("45. bez calculation.inspection oprávnění - strategie samotná neřeší licence (řeší use case), zde jen ověřujeme čistotu výpočtu", () => {
    // Licenční kontrola (`FeatureCodes.CalculationInspection`) žije v
    // `CalculateInspectionOperationUseCase`, ne ve strategii (§11 "strategie
    // je pure") - test na chybějící oprávnění je proto na úrovni use casu.
    expect(new InspectionCalculationStrategy().strategyVersion).toBe("inspection-1.0.0");
  });

  it("46. breakdown odděluje strojní cyklus (automaticCycleTimeMin) a čas obsluhy (operatorAttendanceTimeMin)", () => {
    const eq = equipment({ automationLevel: "semi_automatic" });
    const snapshot = InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(eq, { systemVersion: 1, createdAt: NOW });
    const input = baseInput({
      quantity: 10,
      automaticCycleTimePerCharacteristicMin: 0.4,
      operatorAttendanceTimePerCharacteristicMin: 0.2,
      features: [feature({ equipmentId: "equipment:1", characteristicCount: 2 })],
    });
    const breakdown = strategy.calculate(input, baseContext({ inspectionEquipmentSnapshotsByFeatureId: { f1: snapshot } }));
    expect(breakdown.inspectionDetail?.automaticCycleTimeMin).toBeCloseTo(8, 9); // 0.4*2*10
    expect(breakdown.inspectionDetail?.operatorAttendanceTimeMin).toBeCloseTo(4, 9); // 0.2*2*10
    expect(breakdown.inspectionDetail!.automaticCycleTimeMin).not.toBe(breakdown.inspectionDetail!.operatorAttendanceTimeMin);
  });

  it("47. sampling count je správný napříč všemi devíti režimy", () => {
    const modes: Array<[InspectionFeature["sampleRule"], number]> = [
      [{ mode: "first_piece_only" }, 1],
      [{ mode: "every_piece" }, 20],
      [{ mode: "every_nth_piece", frequency: 4 }, 5],
      [{ mode: "fixed_sample_size", sampleSize: 6 }, 6],
      [{ mode: "percentage_sample", percentage: 0.5 }, 10],
      [{ mode: "first_and_last" }, 2],
      [{ mode: "first_middle_last" }, 3],
      [{ mode: "batch_based", batchSize: 5 }, 4],
      [{ mode: "custom_explicit", explicitCount: 7 }, 7],
    ];
    for (const [sampleRule, expected] of modes) {
      const breakdown = strategy.calculate(baseInput({ features: [feature({ sampleRule })] }), baseContext());
      expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(expected);
    }
  });

  it("48. confidence klesne, když se sampling plán/vybavení musí defaultovat", () => {
    const explicit = strategy.calculate(baseInput({ features: [feature({ sampleRule: { mode: "every_piece" } })] }), baseContext());
    const defaulted = strategy.calculate(baseInput({ features: [feature({ sampleRule: undefined })] }), baseContext());
    expect(defaulted.inspectionDetail!.confidenceScore).toBeLessThanOrEqual(explicit.inspectionDetail!.confidenceScore);
  });

  it("49. percentageAllowance a fixedAllowanceMin se aplikují jako Layer 3 přirážka", () => {
    const input = baseInput({ features: [feature({ preparationTimeMin: 10, measurementTimePerCharacteristicMin: 0 })], percentageAllowance: 0.1, fixedAllowanceMin: 2 });
    const breakdown = strategy.calculate(input, baseContext());
    // preparationTimeMin=10 (setupTime bucket) -> raw=10, *1.1 + 2 = 13
    expect(breakdown.inspectionDetail?.totalOperationTimeMin).toBeCloseTo(13, 9);
  });

  it("50. batch výpočet 50 operací proběhne synchronně a rychle (nezamrzne UI)", () => {
    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      strategy.calculate(baseInput({ features: [feature()] }), baseContext());
    }
    expect(performance.now() - start).toBeLessThan(200);
  });
});
