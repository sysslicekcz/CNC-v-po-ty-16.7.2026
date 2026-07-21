import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { InspectionEquipmentProfile } from "./inspection-equipment-profile";
import { InspectionEquipmentProfileSnapshot } from "./inspection-equipment-profile-snapshot";
import { InspectionCalculationStrategy } from "./inspection-calculation-strategy";
import { InspectionCalculationInput } from "./inspection-calculation-input";

/**
 * Golden master testy pro kontrolní operace (AP-MCE-001 Fáze F §22) - 2 (ze 6
 * celkových Fáze F, zbylé 4 pokrývá `manual-golden-master.test.ts` a tenhle
 * soubor - viz rozdělení "100% rozměrová kontrola" a "CMM kontrola s
 * protokolem" jsou tady, "výběrová kontrola every_nth_piece" taky).
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
  return { operationCategory: "inspection", operationTypeId: "op-type:inspection", quantity: 100, materialId: "material:1", ...overrides };
}

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

const strategy = new InspectionCalculationStrategy();

describe("InspectionCalculationStrategy - golden master (AP-MCE-001 Fáze F §22)", () => {
  it("1. 100% rozměrová kontrola (every_piece, ruční)", () => {
    const input = baseInput({
      inspectionSubtype: "dimensional_manual",
      samplingPlan: "every_piece",
      measurementTimePerCharacteristicMin: 0.2,
      characteristicCount: 2,
      preparationTimeMin: 3,
    });
    const breakdown = strategy.calculate(input, baseContext());

    expect(breakdown.inspectionDetail?.totalOperationTimeMin).toBeCloseTo(43, 9);
    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(100);
    // Ruční měření bez přiřazeného InspectionEquipmentProfile = "ručně zadaný
    // čas bez zdroje" (§14 `manualTimeWithoutSource`) - confidence penalizovaná.
    expect(breakdown.inspectionDetail?.confidenceScore).toBeCloseTo(0.85, 9);

    const second = strategy.calculate(input, baseContext());
    expect(normalize(second.inspectionDetail)).toEqual(normalize(breakdown.inspectionDetail));
  });

  it("2. výběrová kontrola každého desátého kusu (every_nth_piece)", () => {
    const input = baseInput({
      quantity: 50,
      inspectionSubtype: "gauge",
      samplingPlan: "every_nth_piece",
      samplingFrequency: 10,
      measurementTimePerCharacteristicMin: 1,
      characteristicCount: 1,
    });
    const breakdown = strategy.calculate(input, baseContext());

    expect(breakdown.inspectionDetail?.features[0].inspectedPieceCount).toBe(5);
    expect(breakdown.inspectionDetail?.totalOperationTimeMin).toBeCloseTo(5, 9);

    const second = strategy.calculate(input, baseContext());
    expect(normalize(second.inspectionDetail)).toEqual(normalize(breakdown.inspectionDetail));
  });

  it("3. CMM kontrola s protokolem (automatizovaný cyklus + reportGeneration)", () => {
    const equipment = InspectionEquipmentProfile.create({
      id: "equipment:cmm-1",
      tenantId: TENANT_ID,
      equipmentType: "cmm",
      supportedInspectionSubtypes: ["dimensional_cmm"],
      setupTimeMin: 10,
      equipmentCoefficient: 1,
      automationLevel: "automatic",
      reportGenerationMode: "automatic",
      recordVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
    const snapshot = InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(equipment, { systemVersion: 1, createdAt: NOW });

    const input = baseInput({
      quantity: 20,
      samplingPlan: "every_piece",
      inspectionEquipmentIds: ["equipment:cmm-1"],
      programCreationTimeMin: 15,
      programLoadTimeMin: 2,
      fixtureSetupTimeMin: 3,
      automaticCycleTimePerCharacteristicMin: 0.3,
      operatorAttendanceTimePerCharacteristicMin: 0.1,
      evaluationTimePerCharacteristicMin: 0.05,
      reportTimeMin: 5,
      features: [{ id: "f1", sequence: 0, subtype: "dimensional_cmm", inspectionLevel: "hundred_percent", equipmentId: "equipment:cmm-1", characteristicCount: 4 }],
    });
    const breakdown = strategy.calculate(input, baseContext({ inspectionEquipmentSnapshotsByFeatureId: { f1: snapshot } }));

    expect(breakdown.inspectionDetail?.automaticCycleTimeMin).toBeCloseTo(24, 9);
    expect(breakdown.inspectionDetail?.operatorAttendanceTimeMin).toBeCloseTo(8, 9);
    expect(breakdown.inspectionDetail?.reportTimeMin).toBeCloseTo(5, 9);
    expect(breakdown.inspectionDetail?.totalOperationTimeMin).toBeCloseTo(63, 9);

    const second = strategy.calculate(input, baseContext({ inspectionEquipmentSnapshotsByFeatureId: { f1: snapshot } }));
    expect(normalize(second.inspectionDetail)).toEqual(normalize(breakdown.inspectionDetail));
  });
});
