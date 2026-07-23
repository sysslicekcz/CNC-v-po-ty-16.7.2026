import { describe, it, expect } from "vitest";
import { buildTurningInput, buildMillingInput, buildGrindingInput, buildManualInput, buildInspectionInput } from "./form-input-builders";
import { GenericCalculationDraftData, StrategyFormFieldContracts } from "./form-field-contract";

/**
 * `form-input-builders.ts` unit testy (AP-MCE-001 Fáze H §39 "Integrační
 * testy") - mapování UI konceptu na doménový vstup je nejrizikovější kód
 * Fáze H formulářového enginu, protože skládá pole přes `as` přetypování;
 * tenhle soubor ověřuje, že výstup skutečně odpovídá kontraktu, ne že se jen
 * zkompiluje. Kontrakty jsou lokální minimální fixtures (ne import
 * prezentačních schémat) - Application testy nesmí záviset na presentation
 * vrstvě, i jen v testu, aby test zůstal stabilní bez ohledu na to, jak UI
 * schéma vypadá.
 */

function baseDraft(overrides: Partial<GenericCalculationDraftData> = {}): GenericCalculationDraftData {
  return {
    operationTypeId: "op-1",
    quantity: "10",
    materialId: "mat-1",
    machineId: "machine-1",
    toolId: "tool-1",
    workstationId: "",
    operationFields: {},
    features: [],
    ...overrides,
  };
}

const TURNING_CONTRACTS: StrategyFormFieldContracts = {
  featureFields: [
    { key: "startDiameterMm", group: "geometry", type: "number" },
    { key: "threadPitchMm", group: "geometry", type: "number", appliesToSubtypes: ["threading"] },
    { key: "cuttingSpeedMMin", group: "cuttingConditionOverride", type: "number" },
    { key: "passCount", group: "passStrategy", type: "number" },
    { key: "toolProfileId", group: "feature", type: "text" },
    { key: "interruptedCut", group: "feature", type: "checkbox" },
    { key: "coolantMode", group: "feature", type: "text" },
  ],
  operationFields: [
    { key: "setupTimeMin", group: "feature", type: "number" },
    { key: "workstationId", group: "feature", type: "text" },
  ],
};

const MILLING_CONTRACTS: StrategyFormFieldContracts = {
  featureFields: [
    { key: "widthOfCutMm", group: "feature", type: "number" },
    { key: "depthOfCutMm", group: "feature", type: "number" },
  ],
  operationFields: [],
};

const GRINDING_CONTRACTS: StrategyFormFieldContracts = {
  featureFields: [{ key: "dressingIntervalPieces", group: "dressingStrategy", type: "number" }],
  operationFields: [],
};

const MANUAL_CONTRACTS: StrategyFormFieldContracts = { featureFields: [], operationFields: [] };
const INSPECTION_CONTRACTS: StrategyFormFieldContracts = { featureFields: [], operationFields: [] };

describe("buildTurningInput", () => {
  it("namapuje společná pole a operationCategory", () => {
    const input = buildTurningInput(baseDraft(), TURNING_CONTRACTS);
    expect(input.operationCategory).toBe("turning");
    expect(input.operationTypeId).toBe("op-1");
    expect(input.quantity).toBe(10);
    expect(input.materialId).toBe("mat-1");
    expect(input.machineId).toBe("machine-1");
    expect(input.features).toEqual([]);
  });

  it("přeskočí subtype-specifické pole (threadPitchMm), pokud feature není 'threading'", () => {
    const draft = baseDraft({
      features: [{ id: "f1", subtype: "external_longitudinal", machiningMode: "roughing", fields: { "geometry.startDiameterMm": "50", "geometry.threadPitchMm": "1.5" } }],
    });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    const geometry = input.features[0].geometry as unknown as Record<string, unknown>;
    expect(geometry.startDiameterMm).toBe(50);
    expect(geometry.threadPitchMm).toBeUndefined();
  });

  it("zahrne subtype-specifické pole (threadPitchMm), pokud feature JE 'threading'", () => {
    const draft = baseDraft({
      features: [{ id: "f1", subtype: "threading", machiningMode: "finishing", fields: { "geometry.startDiameterMm": "20", "geometry.threadPitchMm": "1.5" } }],
    });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    const geometry = input.features[0].geometry as unknown as Record<string, unknown>;
    expect(geometry.threadPitchMm).toBe(1.5);
  });

  it("cuttingConditionOverride/passStrategy zůstávají undefined, pokud uživatel nic nevyplnil", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "facing", fields: { "geometry.startDiameterMm": "30" } }] });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    expect(input.features[0].cuttingConditionOverride).toBeUndefined();
    expect(input.features[0].passStrategy).toBeUndefined();
  });

  it("cuttingConditionOverride se naplní, pokud uživatel vyplnil aspoň jedno pole skupiny", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "facing", fields: { "cuttingConditionOverride.cuttingSpeedMMin": "180" } }] });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    expect(input.features[0].cuttingConditionOverride).toEqual({ cuttingSpeedMMin: 180 });
  });

  it("checkbox pole (interruptedCut) se parsuje na boolean", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "facing", fields: { "feature.interruptedCut": true } }] });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    expect((input.features[0] as unknown as Record<string, unknown>).interruptedCut).toBe(true);
  });

  it("operationFields (setupTimeMin) se namapují na kořen vstupu", () => {
    const draft = baseDraft({ operationFields: { "feature.setupTimeMin": "12.5", "feature.workstationId": "ws-1" } });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    expect((input as unknown as Record<string, unknown>).setupTimeMin).toBe(12.5);
    expect((input as unknown as Record<string, unknown>).workstationId).toBe("ws-1");
  });

  it("prázdný textový vstup se přeskočí (zůstane undefined, ne prázdný řetězec)", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "facing", fields: { "feature.coolantMode": "" } }] });
    const input = buildTurningInput(draft, TURNING_CONTRACTS);
    expect((input.features[0] as unknown as Record<string, unknown>).coolantMode).toBeUndefined();
  });
});

describe("buildMillingInput", () => {
  it("extrahuje widthOfCutMm/depthOfCutMm do vnořeného toolEngagement", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "face_milling", fields: { "feature.widthOfCutMm": "12", "feature.depthOfCutMm": "3" } }] });
    const input = buildMillingInput(draft, MILLING_CONTRACTS);
    expect(input.features[0].toolEngagement).toEqual({ widthOfCutMm: 12, depthOfCutMm: 3 });
  });

  it("toolEngagement zůstává undefined, pokud nebyly vyplněny", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "face_milling", fields: {} }] });
    const input = buildMillingInput(draft, MILLING_CONTRACTS);
    expect(input.features[0].toolEngagement).toBeUndefined();
  });
});

describe("buildGrindingInput", () => {
  it("dressingStrategy se naplní jen když je aspoň jedno pole vyplněné", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "plunge", fields: { "dressingStrategy.dressingIntervalPieces": "50" } }] });
    const input = buildGrindingInput(draft, GRINDING_CONTRACTS);
    expect(input.features[0].dressingStrategy).toEqual({ dressingIntervalPieces: 50 });
  });

  it("dressingStrategy zůstává undefined bez vyplnění", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "plunge", fields: {} }] });
    const input = buildGrindingInput(draft, GRINDING_CONTRACTS);
    expect(input.features[0].dressingStrategy).toBeUndefined();
  });
});

describe("buildManualInput", () => {
  it("bez featurů použije baseUnitTimeMin místo pole features", () => {
    const draft = baseDraft({ baseUnitTimeMin: "4.2" });
    const input = buildManualInput(draft, MANUAL_CONTRACTS);
    expect(input.features).toBeUndefined();
    expect(input.baseUnitTimeMin).toBe(4.2);
  });

  it("s featury vrací pole features a ignoruje baseUnitTimeMin", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "deburring", fields: {} }] });
    const input = buildManualInput(draft, MANUAL_CONTRACTS);
    expect(input.features).toHaveLength(1);
    expect(input.features?.[0].subtype).toBe("deburring");
  });
});

describe("buildInspectionInput", () => {
  it("inspectionLevel se odvodí z measurementRequirement featuru, výchozí 'sample'", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "dimensional_manual", fields: {} }] });
    const input = buildInspectionInput(draft, INSPECTION_CONTRACTS);
    expect(input.features?.[0].inspectionLevel).toBe("sample");
  });

  it("inspectionLevel respektuje explicitně zvolený measurementRequirement", () => {
    const draft = baseDraft({ features: [{ id: "f1", subtype: "dimensional_manual", measurementRequirement: "hundred_percent", fields: {} }] });
    const input = buildInspectionInput(draft, INSPECTION_CONTRACTS);
    expect(input.features?.[0].inspectionLevel).toBe("hundred_percent");
  });
});
