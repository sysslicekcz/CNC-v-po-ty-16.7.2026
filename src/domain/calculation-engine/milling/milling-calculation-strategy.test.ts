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
import { MachineWorkEnvelope } from "../profiles/machine-work-envelope";
import { MillingCalculationStrategy } from "./milling-calculation-strategy";
import { MillingCalculationInput } from "./milling-calculation-input";
import { MillingFeature } from "./milling-feature";

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function ruleVersion(): RuleVersion {
  return RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} });
}

function materialProfile(overrides: Partial<Parameters<typeof MaterialProfile.create>[0]> = {}): MaterialProfile {
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
    ...overrides,
  });
}

function machineProfile(overrides: Partial<Parameters<typeof MachineProfile.create>[0]> = {}): MachineProfile {
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
    ...overrides,
  });
}

function toolProfile(overrides: Partial<Parameters<typeof ToolProfile.create>[0]> = {}): ToolProfile {
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
    ...overrides,
  });
}

function context(overrides: Partial<CalculationContext> = {}): CalculationContext {
  const material = overrides.materialProfileSnapshot === null ? undefined : materialProfile();
  return {
    ruleVersion: ruleVersion(),
    materialProfileSnapshot: material && MaterialProfileSnapshot.forMaterialProfile(material, { systemVersion: 1, createdAt: NOW }),
    ...overrides,
  };
}

function contextWithMachineAndTool(machine: MachineProfile, tool?: ToolProfile, featureId = "feature:1"): CalculationContext {
  return context({
    machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
    toolProfileSnapshotsByFeatureId: tool ? { [featureId]: ToolProfileSnapshot.forToolProfile(tool, { systemVersion: 1, createdAt: NOW }) } : undefined,
  });
}

function faceMillingFeature(overrides: Partial<MillingFeature> = {}): MillingFeature {
  return {
    id: "feature:1",
    sequence: 0,
    subtype: "face_milling",
    machiningMode: "roughing",
    geometry: { areaLengthMm: 100, areaWidthMm: 50, approachLengthMm: 2, retractLengthMm: 2 },
    toolProfileId: "tool:1",
    pathStrategy: { stepOverMm: 6 },
    ...overrides,
  };
}

function input(features: MillingFeature[], overrides: Partial<MillingCalculationInput> = {}): MillingCalculationInput {
  return {
    operationCategory: "milling",
    operationTypeId: "op-type:milling",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features,
    ...overrides,
  };
}

const strategy = new MillingCalculationStrategy();

function assertNoBlockingErrors(issues: ReturnType<MillingCalculationStrategy["validate"]>) {
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
}

describe("MillingCalculationStrategy", () => {
  it("Scénář 1: rovinné frézování jedním přejezdem (stepOver >= šířka plochy)", () => {
    const i = input([faceMillingFeature({ pathStrategy: { stepOverMm: 60 } })]);
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(1);
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 2: rovinné frézování více přejezdy", () => {
    const i = input([faceMillingFeature({ pathStrategy: { stepOverMm: 6 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].widthPasses).toBeGreaterThan(1);
  });

  it("Scénář 3: kapsa hrubování", () => {
    const i = input([
      faceMillingFeature({
        subtype: "pocket_milling",
        machiningMode: "roughing",
        geometry: { pocketLengthMm: 60, pocketWidthMm: 40, pocketDepthMm: 10, approachLengthMm: 2, retractLengthMm: 2 },
        pathStrategy: { stepOverMm: 6, stepDownMm: 3 },
      }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.millingDetail!.features[0];
    expect(feature.depthLayers).toBe(4);
    expect(feature.effectivePathLengthMm).toBeGreaterThan(0);
  });

  it("Scénář 4: kapsa dokončení (obvodový průchod)", () => {
    const i = input([
      faceMillingFeature({
        subtype: "pocket_milling",
        machiningMode: "finishing",
        geometry: { pocketLengthMm: 60, pocketWidthMm: 40, pocketDepthMm: 10, approachLengthMm: 2, retractLengthMm: 2 },
        pathStrategy: { stepDownMm: 10 },
      }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.millingDetail!.features[0];
    expect(feature.pathStrategy).toBe("pocket");
    expect(feature.depthLayers).toBe(1);
  });

  it("Scénář 5: obvodová kontura", () => {
    const i = input([
      faceMillingFeature({ subtype: "contour_milling", geometry: { contourLengthMm: 200, approachLengthMm: 3, retractLengthMm: 3 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.millingDetail!.features[0];
    expect(feature.effectivePathLengthMm).toBeCloseTo(206);
  });

  it("Scénář 6: drážka jedním bočním záběrem (šířka <= průměr nástroje)", () => {
    const i = input([
      faceMillingFeature({ subtype: "slot_milling", geometry: { slotLengthMm: 80, slotWidthMm: 10, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(1);
  });

  it("Scénář 7: drážka více bočními záběry (šířka > průměr nástroje)", () => {
    const i = input([
      faceMillingFeature({ subtype: "slot_milling", geometry: { slotLengthMm: 80, slotWidthMm: 25, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 }, pathStrategy: { stepOverMm: 5 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].widthPasses).toBeGreaterThan(1);
  });

  it("Scénář 8: vrtání jednoho otvoru", () => {
    const i = input([faceMillingFeature({ subtype: "drilling", geometry: { machiningDepthMm: 20, approachLengthMm: 2, retractLengthMm: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(1);
  });

  it("Scénář 9: vrtání více otvorů", () => {
    const i = input([faceMillingFeature({ subtype: "drilling", geometry: { machiningDepthMm: 20, approachLengthMm: 2, retractLengthMm: 5, holeCount: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].widthPasses).toBe(5);
  });

  it("Scénář 10: peck drilling (víc pecků na otvor)", () => {
    const i = input([faceMillingFeature({ subtype: "drilling", geometry: { machiningDepthMm: 30, approachLengthMm: 2, retractLengthMm: 5, peckDepthMm: 10 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].depthLayers).toBe(3);
  });

  it("Scénář 11: zahlubování", () => {
    const i = input([faceMillingFeature({ subtype: "countersinking", geometry: { machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].subtype).toBe("countersinking");
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 12: vystružování", () => {
    const i = input([faceMillingFeature({ subtype: "reaming", geometry: { machiningDepthMm: 20, approachLengthMm: 2, retractLengthMm: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].subtype).toBe("reaming");
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 13: řezání závitu", () => {
    const machine = machineProfile({ availableFunctions: [] });
    const i = input([
      faceMillingFeature({ subtype: "threading", geometry: { machiningDepthMm: 15, approachLengthMm: 2, retractLengthMm: 5, threadPitchMm: 1.5 } }),
    ]);
    const ctx = contextWithMachineAndTool(machine, toolProfile());
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.millingDetail?.features[0].subtype).toBe("threading");
  });

  it("Scénář 14: 2D frézování (explicitní dráha)", () => {
    const i = input([faceMillingFeature({ subtype: "two_d", geometry: { pathLengthMm: 300, approachLengthMm: 2, retractLengthMm: 2 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].effectivePathLengthMm).toBeCloseTo(300);
  });

  it("Scénář 15: 2.5D frézování (opakování dráhy po vrstvách)", () => {
    const i = input([
      faceMillingFeature({ subtype: "two_and_half_d", geometry: { pathLengthMm: 100, machiningDepthMm: 9, approachLengthMm: 0, retractLengthMm: 0 }, pathStrategy: { stepDownMm: 3 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.millingDetail!.features[0];
    expect(feature.depthLayers).toBe(3);
    expect(feature.effectivePathLengthMm).toBeCloseTo(300);
  });

  it("Scénář 16: 3D aproximace - nižší confidence a označení v breakdownu", () => {
    const i = input([
      faceMillingFeature({ subtype: "three_d", geometry: { areaLengthMm: 100, areaWidthMm: 50, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const withoutThreeD = strategy.calculate(input([faceMillingFeature()]), contextWithMachineAndTool(machineProfile(), toolProfile()));
    const withThreeD = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = withThreeD.millingDetail!.features[0];
    expect(feature.approximationType).toBe("three_d_surface");
    expect(withThreeD.millingDetail!.confidenceScore).toBeLessThan(withoutThreeD.millingDetail!.confidenceScore);
  });

  it("Scénář 17: custom path", () => {
    const i = input([faceMillingFeature({ subtype: "custom_path", geometry: { pathLengthMm: 250, approachLengthMm: 0, retractLengthMm: 0 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features[0].effectivePathLengthMm).toBeCloseTo(250);
  });

  it("Scénář 18: víc featurů v jedné operaci, pořadí zachováno", () => {
    const i = input([faceMillingFeature({ id: "feature:b", sequence: 1 }), faceMillingFeature({ id: "feature:a", sequence: 0 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features.map((f) => f.featureId)).toEqual(["feature:a", "feature:b"]);
  });

  it("Scénář 19: víc nástrojů - výměna mezi featury s různým nástrojem", () => {
    const toolA = toolProfile({ id: "tool:a" });
    const toolB = toolProfile({ id: "tool:b", toolChangeTimeSec: 30 });
    const i = input([
      faceMillingFeature({ id: "feature:a", sequence: 0, toolProfileId: "tool:a" }),
      faceMillingFeature({ id: "feature:b", sequence: 1, toolProfileId: "tool:b" }),
    ]);
    const ctx = context({
      machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machineProfile(), { systemVersion: 1, createdAt: NOW }),
      toolProfileSnapshotsByFeatureId: {
        "feature:a": ToolProfileSnapshot.forToolProfile(toolA, { systemVersion: 1, createdAt: NOW }),
        "feature:b": ToolProfileSnapshot.forToolProfile(toolB, { systemVersion: 1, createdAt: NOW }),
      },
    });
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.millingDetail?.toolChangeAccounting.initialToolLoads).toBe(1);
    expect(breakdown.millingDetail?.toolChangeAccounting.interFeatureToolChanges).toBe(1);
  });

  it("Scénář 20: stejný nástroj ve dvou featurech za sebou nezaloží zbytečnou výměnu", () => {
    const i = input([
      faceMillingFeature({ id: "feature:a", sequence: 0, toolProfileId: "tool:1" }),
      faceMillingFeature({ id: "feature:b", sequence: 1, toolProfileId: "tool:1" }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile(), "feature:a"));
    expect(breakdown.millingDetail?.toolChangeAccounting.initialToolLoads).toBe(1);
    expect(breakdown.millingDetail?.toolChangeAccounting.interFeatureToolChanges).toBe(0);
  });

  it("Scénář 21: výměna nástroje podle životnosti v kusech", () => {
    const tool = toolProfile({ toolLife: ToolLifeProfile.ofPieces(5) });
    const i = input([faceMillingFeature()], { quantity: 20 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(breakdown.millingDetail?.toolChangeAccounting.wearReplacements).toBeGreaterThan(0);
  });

  it("Scénář 22: výměna nástroje podle životnosti v minutách", () => {
    const tool = toolProfile({ toolLife: ToolLifeProfile.ofMinutes(1) });
    const i = input([faceMillingFeature()], { quantity: 50 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(breakdown.millingDetail?.toolChangeAccounting.wearReplacements).toBeGreaterThan(0);
  });

  it("Scénář 23: otáčky omezené maxRpm stroje", () => {
    const machine = machineProfile({ maxRpm: 100 });
    const i = input([faceMillingFeature({ cuttingConditionOverride: { cuttingSpeedMMin: 500 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.millingDetail?.features[0].spindleSpeedRpm).toBe(100);
    expect(breakdown.millingDetail?.warnings.some((w) => w.code === "RPM_CLAMPED_TO_MACHINE_LIMIT")).toBe(true);
  });

  it("Scénář 24: posuv omezený maximálním posuvem stroje", () => {
    const machine = machineProfile({ maxFeedRateMmMin: 50 });
    const i = input([faceMillingFeature({ cuttingConditionOverride: { feedPerToothMm: 0.5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.millingDetail?.features[0].feedRateMmMin).toBe(50);
    expect(breakdown.millingDetail?.warnings.some((w) => w.code === "FEED_CLAMPED_TO_MACHINE_LIMIT")).toBe(true);
  });

  it("Scénář 25: nástroj příliš velký pro útvar", () => {
    const tool = toolProfile({ diameterMm: 30 });
    const i = input([
      faceMillingFeature({ subtype: "pocket_milling", geometry: { pocketLengthMm: 60, pocketWidthMm: 20, pocketDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(issues.some((iss) => iss.code === "TOOL_TOO_LARGE_FOR_FEATURE" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 26: nástroj příliš krátký na hloubku", () => {
    const tool = toolProfile({ usableLengthMm: 10 });
    const i = input([
      faceMillingFeature({ subtype: "pocket_milling", geometry: { pocketLengthMm: 60, pocketWidthMm: 40, pocketDepthMm: 30, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(issues.some((iss) => iss.code === "TOOL_TOO_SHORT_FOR_DEPTH" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 27: nedostatečný počet os pro 3D obrábění", () => {
    const machine = machineProfile({ axisCount: 2 });
    const i = input([faceMillingFeature({ subtype: "three_d", geometry: { areaLengthMm: 50, areaWidthMm: 50, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } })]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(issues.some((iss) => iss.code === "MACHINE_AXIS_COUNT_INSUFFICIENT" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 28: rigid tapping nedostupný", () => {
    const machine = machineProfile({ availableFunctions: [{ capabilityTypeId: "cap:coolant", capabilityTypeCode: "coolant_through_spindle", value: true }] });
    const i = input([faceMillingFeature({ subtype: "threading", geometry: { machiningDepthMm: 15, approachLengthMm: 2, retractLengthMm: 5, threadPitchMm: 1.5 } })]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(issues.some((iss) => iss.code === "RIGID_TAPPING_UNAVAILABLE" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 29: 3D interpolace nedostupná", () => {
    const machine = machineProfile({ availableFunctions: [{ capabilityTypeId: "cap:coolant", capabilityTypeCode: "coolant_through_spindle", value: true }] });
    const i = input([faceMillingFeature({ subtype: "three_d", geometry: { areaLengthMm: 50, areaWidthMm: 50, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } })]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(issues.some((iss) => iss.code === "THREE_D_CAPABILITY_UNAVAILABLE" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 30: překročení výkonu stroje", () => {
    const machine = machineProfile({ maxPowerKw: 0.05 });
    const i = input([faceMillingFeature({ toolEngagement: { widthOfCutMm: 8, depthOfCutMm: 5 }, cuttingConditionOverride: { cuttingSpeedMMin: 300, feedPerToothMm: 0.3 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.millingDetail?.warnings.some((w) => w.code === "MACHINE_POWER_EXCEEDED")).toBe(true);
  });

  it("Scénář 31: překročení pracovního prostoru je blokující chyba", () => {
    const machine = machineProfile({ workEnvelope: MachineWorkEnvelope.create({ maxLengthMm: 20 }) });
    const i = input([faceMillingFeature()]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(issues.some((iss) => iss.code === "WORK_ENVELOPE_EXCEEDED" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 32: quantity = 1", () => {
    const i = input([faceMillingFeature()], { quantity: 1 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 33: quantity = 1000", () => {
    const i = input([faceMillingFeature()], { quantity: 1000 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 34: monotonicita podle quantity (víc kusů = víc času)", () => {
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    const times = [1, 10, 100, 1000].map((quantity) => strategy.calculate(input([faceMillingFeature()], { quantity }), ctx).totalOperationTime.minutes);
    for (let idx = 1; idx < times.length; idx++) {
      expect(times[idx]).toBeGreaterThan(times[idx - 1]);
    }
  });

  it("Scénář 35: determinismus - stejný vstup dá stejný výsledek", () => {
    const i = input([faceMillingFeature()]);
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    const first = strategy.calculate(i, ctx);
    const second = strategy.calculate(i, ctx);
    expect(first.toJSON()).toEqual(second.toJSON());
  });

  it("Scénář 37: výpočet je čistá synchronní funkce (funguje i offline, bez I/O)", () => {
    const i = input([faceMillingFeature()]);
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
    expect(strategy.calculate(i, ctx)).toBeDefined();
  });

  it("Scénář 39: breakdown obsahuje všechny featury", () => {
    const i = input([faceMillingFeature({ id: "f1", sequence: 0 }), faceMillingFeature({ id: "f2", sequence: 1 }), faceMillingFeature({ id: "f3", sequence: 2 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.millingDetail?.features.map((f) => f.featureId)).toEqual(["f1", "f2", "f3"]);
  });

  it("Scénář 40: každý parametr má uložený zdroj", () => {
    const i = input([faceMillingFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const source = breakdown.millingDetail!.features[0].sourceOfEachResolvedParameter;
    expect(source.cuttingSpeed).toBeDefined();
    expect(source.feedPerTooth).toBeDefined();
    expect(source.toolDiameter).toBeDefined();
    expect(source.teethCount).toBeDefined();
    expect(source.spindleSpeed).toBeDefined();
    expect(source.passCount).toBeDefined();
  });

  it("Scénář 41: confidence klesne, když je dráha odvozená místo explicitní", () => {
    const explicitPath = strategy.calculate(
      input([faceMillingFeature({ subtype: "custom_path", geometry: { pathLengthMm: 250, approachLengthMm: 0, retractLengthMm: 0 } })]),
      contextWithMachineAndTool(machineProfile(), toolProfile())
    );
    const derivedPath = strategy.calculate(input([faceMillingFeature()]), contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(derivedPath.millingDetail!.confidenceScore).toBeLessThan(explicitPath.millingDetail!.confidenceScore);
  });

  it("Scénář 42: confidence klesne při 3D aproximaci", () => {
    const withoutThreeD = strategy.calculate(input([faceMillingFeature()]), contextWithMachineAndTool(machineProfile(), toolProfile()));
    const withThreeD = strategy.calculate(
      input([faceMillingFeature({ subtype: "three_d", geometry: { areaLengthMm: 100, areaWidthMm: 50, machiningDepthMm: 5, approachLengthMm: 2, retractLengthMm: 2 } })]),
      contextWithMachineAndTool(machineProfile(), toolProfile())
    );
    expect(withThreeD.millingDetail!.confidenceScore).toBeLessThan(withoutThreeD.millingDetail!.confidenceScore);
  });

  it("confidence klesne při použití systémových defaultů (bez kontextu materiálu/stroje/nástroje)", () => {
    const i = input([faceMillingFeature()]);
    const withContext = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const withoutContext = strategy.calculate(i, context());
    expect(withoutContext.millingDetail!.confidenceScore).toBeLessThan(withContext.millingDetail!.confidenceScore);
  });
});
