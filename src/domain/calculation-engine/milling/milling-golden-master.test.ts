import { describe, it, expect } from "vitest";
import { RuleVersion } from "../rules/rule-version";
import { CalculationContext } from "../contracts/calculation-context";
import { MaterialProfile } from "../profiles/material-profile";
import { MachineProfile } from "../profiles/machine-profile";
import { ToolProfile } from "../profiles/tool-profile";
import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";
import { ToolLifeProfile } from "../profiles/tool-life-profile";
import { ToolWearCurve } from "../profiles/tool-wear-curve";
import { MillingCalculationStrategy } from "./milling-calculation-strategy";
import { MillingCalculationInput } from "./milling-calculation-input";
import { MillingFeature } from "./milling-feature";

/**
 * Golden master testy (AP-MCE-001 Fáze D §20) - 6 referenčních
 * technologických případů se ZAMRAZENÝM očekávaným `millingDetail`, stejný
 * důvod a technika jako Fáze C `turning-golden-master.test.ts` (žádná
 * nedeterministická složka ve `MillingCalculationStrategy`, `toEqual` nad
 * `JSON.parse(JSON.stringify(...))` normalizovaným výstupem = bytová
 * identita pro deterministickou IEEE754 aritmetiku).
 *
 * Očekávané hodnoty jsou zaznamenané z JEDNOHO běhu téhle implementace
 * (`strategyVersion: "milling-1.0.0"`).
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function ruleVersion(): RuleVersion {
  return RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} });
}

function materialProfile(): MaterialProfile {
  return MaterialProfile.create({
    id: "material:1",
    tenantId: TENANT_ID,
    sourceType: "system",
    name: "Ocel 11 523",
    materialGroupId: "material-group:ocel",
    materialGroupName: "Konstrukční oceli",
    materialCoefficient: 1,
    recommendedCuttingSpeeds: [],
    recommendedFeeds: [],
    suitableToolTypeIds: [],
    dataSource: "master-data:material",
    externalReferences: [],
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function machineProfile(): MachineProfile {
  return MachineProfile.create({
    id: "machine-profile:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    physicalMachineId: "machine:1",
    machineCategory: "milling",
    maxRpm: 12000,
    minRpm: 100,
    maxPowerKw: 15,
    axisCount: 3,
    rapidTraverseRateMmMin: 10000,
    maxFeedRateMmMin: 5000,
    availableFunctions: [],
    powerCoefficient: 1,
    ageCoefficient: 1,
    conditionCoefficient: 1,
    typicalSetupTimes: [],
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function toolProfile(): ToolProfile {
  return ToolProfile.create({
    id: "tool:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:1",
    toolTypeName: "Stopková fréza",
    diameterMm: 10,
    usableLengthMm: 40,
    teethCount: 4,
    suitableMaterialGroupIds: [],
    supportedOperationCategories: [],
    defaultCuttingParameters: [],
    toolLife: ToolLifeProfile.unknown(),
    wearFactorCurve: ToolWearCurve.flat(),
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function context(): CalculationContext {
  const material = materialProfile();
  const machine = machineProfile();
  const tool = toolProfile();
  return {
    ruleVersion: ruleVersion(),
    materialProfileSnapshot: MaterialProfileSnapshot.forMaterialProfile(material, { systemVersion: 1, createdAt: NOW }),
    machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
    toolProfileSnapshotsByFeatureId: { "feature:1": ToolProfileSnapshot.forToolProfile(tool, { systemVersion: 1, createdAt: NOW }) },
  };
}

function baseInput(features: MillingFeature[], overrides: Partial<MillingCalculationInput> = {}): MillingCalculationInput {
  return {
    operationCategory: "milling",
    operationTypeId: "op-type:milling",
    quantity: 50,
    materialId: "material:1",
    machineId: "machine:1",
    features,
    ...overrides,
  };
}

const strategy = new MillingCalculationStrategy();

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("MillingCalculationStrategy - golden master (AP-MCE-001 Fáze D §20)", () => {
  it("1. srovnání roviny (face_milling, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "face_milling",
        machiningMode: "roughing",
        geometry: { areaLengthMm: 200, areaWidthMm: 100, machiningDepthMm: 4, approachLengthMm: 3, retractLengthMm: 3 },
        toolProfileId: "tool:1",
        pathStrategy: { stepOverMm: 6, stepDownMm: 2 },
        cuttingConditionOverride: { cuttingSpeedMMin: 150, feedPerToothMm: 0.08 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(230.04261325290426, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(17);
    expect(breakdown.millingDetail?.features[0].spindleSpeedRpm).toBeCloseTo(4774.64829275686, 6);
    expect(breakdown.millingDetail?.features[0].feedRateMmMin).toBeCloseTo(1527.8874536821954, 6);

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });

  it("2. hrubování kapsy (pocket_milling, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "pocket_milling",
        machiningMode: "roughing",
        geometry: { pocketLengthMm: 80, pocketWidthMm: 50, pocketDepthMm: 12, approachLengthMm: 2, retractLengthMm: 2 },
        toolProfileId: "tool:1",
        pathStrategy: { stepOverMm: 6, stepDownMm: 3 },
        cuttingConditionOverride: { cuttingSpeedMMin: 120, feedPerToothMm: 0.06 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(183.44684653592972, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.millingDetail?.features[0].depthLayers).toBe(4);
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(9);

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });

  it("3. dokončení kapsy (pocket_milling, finishing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "pocket_milling",
        machiningMode: "finishing",
        geometry: { pocketLengthMm: 80, pocketWidthMm: 50, pocketDepthMm: 12, approachLengthMm: 2, retractLengthMm: 2 },
        toolProfileId: "tool:1",
        pathStrategy: { stepDownMm: 12 },
        cuttingConditionOverride: { cuttingSpeedMMin: 180, feedPerToothMm: 0.04 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(19.402607128264467, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.millingDetail?.features[0].pathStrategy).toBe("pocket");

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });

  it("4. obvodová kontura (contour_milling)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "contour_milling",
        machiningMode: "finishing",
        geometry: { contourLengthMm: 300, approachLengthMm: 3, retractLengthMm: 3 },
        toolProfileId: "tool:1",
        cuttingConditionOverride: { cuttingSpeedMMin: 200, feedPerToothMm: 0.05 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(13.326243337446202, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.millingDetail?.features[0].effectivePathLengthMm).toBe(306);

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });

  it("5. vrtání více otvorů (drilling, peck cykly)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "drilling",
        machiningMode: "roughing",
        geometry: { machiningDepthMm: 25, approachLengthMm: 3, retractLengthMm: 5, holeCount: 6, peckDepthMm: 10 },
        toolProfileId: "tool:1",
        cuttingConditionOverride: { cuttingSpeedMMin: 80, feedPerToothMm: 0.1 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(22.255418483298424, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.9, 9);
    const feature = breakdown.millingDetail!.features[0];
    expect(feature.depthLayers * feature.widthPasses).toBe(18);

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });

  it("6. řezání závitu (threading)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "threading",
        machiningMode: "finishing",
        geometry: { machiningDepthMm: 15, approachLengthMm: 3, retractLengthMm: 5, threadPitchMm: 1.5, holeCount: 2 },
        toolProfileId: "tool:1",
        cuttingConditionOverride: { cuttingSpeedMMin: 60 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.millingDetail?.totalOperationTimeMin).toBeCloseTo(1.5855308443374598, 9);
    expect(breakdown.millingDetail?.confidenceScore).toBeCloseTo(0.8, 9);
    expect(breakdown.millingDetail?.features[0].feedRateMmMin).toBeCloseTo(2864.7889756541163, 6);

    const second = strategy.calculate(input, context());
    expect(normalize(second.millingDetail)).toEqual(normalize(breakdown.millingDetail));
  });
});
