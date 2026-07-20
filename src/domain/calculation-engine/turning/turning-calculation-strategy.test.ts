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
import { TurningCalculationStrategy } from "./turning-calculation-strategy";
import { TurningCalculationInput } from "./turning-calculation-input";
import { TurningFeature } from "./turning-feature";

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
    machineCategory: "lathe",
    maxRpm: 4000,
    maxPowerKw: 15,
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
    toolTypeName: "Soustružnický nůž",
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
    toolProfileSnapshotsByFeatureId: tool
      ? { [featureId]: ToolProfileSnapshot.forToolProfile(tool, { systemVersion: 1, createdAt: NOW }) }
      : undefined,
  });
}

function longitudinalFeature(overrides: Partial<TurningFeature> = {}): TurningFeature {
  return {
    id: "feature:1",
    sequence: 0,
    subtype: "external_longitudinal",
    machiningMode: "roughing",
    geometry: { startDiameterMm: 50, endDiameterMm: 46, machiningLengthMm: 100, approachLengthMm: 2, retractLengthMm: 2 },
    toolProfileId: "tool:1",
    passStrategy: { roughingDepthOfCutMm: 1 },
    ...overrides,
  };
}

function input(features: TurningFeature[], overrides: Partial<TurningCalculationInput> = {}): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    toolId: "tool:1",
    features,
    ...overrides,
  };
}

const strategy = new TurningCalculationStrategy();

function assertNoBlockingErrors(issues: ReturnType<TurningCalculationStrategy["validate"]>) {
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
}

describe("TurningCalculationStrategy", () => {
  it("Scénář 1: jednoduché vnější podélné soustružení", () => {
    const i = input([longitudinalFeature()]);
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
    expect(breakdown.turningDetail?.features).toHaveLength(1);
  });

  it("Scénář 2: automatický počet hrubovacích průchodů (radialStock=2, depth=1 -> 2 průchody)", () => {
    const i = input([longitudinalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].roughingPasses).toBe(2);
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(2);
  });

  it("Scénář 3: explicitní počet průchodů má přednost a je označen jako ruční", () => {
    const i = input([longitudinalFeature({ passStrategy: { passCount: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].roughingPasses).toBe(5);
    expect(breakdown.turningDetail?.warnings.some((w) => w.code === "MANUAL_PASS_COUNT_USED")).toBe(true);
  });

  it("Scénář 4: hrubování + dokončování jako dva featury", () => {
    const i = input([
      longitudinalFeature({ id: "feature:rough", sequence: 0, machiningMode: "roughing" }),
      longitudinalFeature({
        id: "feature:finish",
        sequence: 1,
        machiningMode: "finishing",
        geometry: { startDiameterMm: 46, endDiameterMm: 45, machiningLengthMm: 100, approachLengthMm: 2, retractLengthMm: 2 },
        passStrategy: {},
      }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features).toHaveLength(2);
    expect(breakdown.turningDetail?.features[0].roughingPasses).toBeGreaterThan(0);
    expect(breakdown.turningDetail?.features[1].finishingPasses).toBe(1);
  });

  it("Scénář 5: vnitřní soustružení", () => {
    const i = input([longitudinalFeature({ subtype: "internal_longitudinal" })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].subtype).toBe("internal_longitudinal");
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 6: čelní soustružení", () => {
    const i = input([
      longitudinalFeature({ subtype: "facing", geometry: { startDiameterMm: 50, endDiameterMm: 0.1, machiningLengthMm: 2, approachLengthMm: 1, retractLengthMm: 1 }, passStrategy: { roughingDepthOfCutMm: 0.5 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.turningDetail!.features[0];
    expect(feature.subtype).toBe("facing");
    expect(feature.totalPasses).toBeGreaterThan(0);
  });

  it("Scénář 7: vrtání jednoho otvoru", () => {
    const i = input([
      longitudinalFeature({ subtype: "drilling", geometry: { startDiameterMm: 10, endDiameterMm: 10, machiningLengthMm: 30, approachLengthMm: 2, retractLengthMm: 0 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(1);
  });

  it("Scénář 8: vrtání více otvorů", () => {
    const i = input([
      longitudinalFeature({ subtype: "drilling", geometry: { startDiameterMm: 10, endDiameterMm: 10, machiningLengthMm: 30, approachLengthMm: 2, retractLengthMm: 0, holeCount: 4 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(4);
    expect(breakdown.turningDetail?.features[0].axialStockMm).toBe(120);
  });

  it("Scénář 9: peck drilling (víc pecků na otvor)", () => {
    const i = input([
      longitudinalFeature({
        subtype: "drilling",
        geometry: { startDiameterMm: 10, endDiameterMm: 10, machiningLengthMm: 30, approachLengthMm: 2, retractLengthMm: 0, peckDepthMm: 10 },
      }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(3);
  });

  it("Scénář 10: zapichování", () => {
    const i = input([
      longitudinalFeature({ subtype: "grooving", geometry: { startDiameterMm: 40, endDiameterMm: 34, machiningLengthMm: 4, approachLengthMm: 1, retractLengthMm: 1 }, passStrategy: { roughingDepthOfCutMm: 2 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const feature = breakdown.turningDetail!.features[0];
    expect(feature.subtype).toBe("grooving");
    expect(feature.radialStockMm).toBeCloseTo(3);
  });

  it("Scénář 11: upichování", () => {
    const i = input([
      longitudinalFeature({ subtype: "parting", geometry: { startDiameterMm: 30, endDiameterMm: 0.5, machiningLengthMm: 3, approachLengthMm: 1, retractLengthMm: 1 }, passStrategy: { roughingDepthOfCutMm: 2 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].subtype).toBe("parting");
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 12: řezání závitu", () => {
    const i = input([
      longitudinalFeature({
        subtype: "threading",
        geometry: { startDiameterMm: 20, endDiameterMm: 20, machiningLengthMm: 25, approachLengthMm: 3, retractLengthMm: 3, threadPitchMm: 1.5 },
        passStrategy: { passCount: 4 },
      }),
    ]);
    assertNoBlockingErrors(strategy.validate(i, contextWithMachineAndTool(machineProfile(), toolProfile())));
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].feedPerRevolutionMm).toBeCloseTo(1.5);
  });

  it("Scénář 13: custom path", () => {
    const i = input([
      longitudinalFeature({
        subtype: "custom_path",
        geometry: { startDiameterMm: 30, endDiameterMm: 30, machiningLengthMm: 10, approachLengthMm: 0, retractLengthMm: 0, customPathLengthMm: 150, customPathRepeats: 1 },
      }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features[0].cuttingLengthMm).toBeGreaterThan(0);
  });

  it("Scénář 14: víc featurů v jedné operaci, pořadí zachováno", () => {
    const i = input([
      longitudinalFeature({ id: "feature:b", sequence: 1 }),
      longitudinalFeature({ id: "feature:a", sequence: 0 }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features.map((f) => f.featureId)).toEqual(["feature:a", "feature:b"]);
  });

  it("Scénář 15: výměna nástroje mezi featury s různým nástrojem", () => {
    const toolA = toolProfile({ id: "tool:a" });
    const toolB = toolProfile({ id: "tool:b", toolChangeTimeSec: 30 });
    const i = input([
      longitudinalFeature({ id: "feature:a", sequence: 0, toolProfileId: "tool:a" }),
      longitudinalFeature({ id: "feature:b", sequence: 1, toolProfileId: "tool:b" }),
    ]);
    const ctx = context({
      machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machineProfile(), { systemVersion: 1, createdAt: NOW }),
      toolProfileSnapshotsByFeatureId: {
        "feature:a": ToolProfileSnapshot.forToolProfile(toolA, { systemVersion: 1, createdAt: NOW }),
        "feature:b": ToolProfileSnapshot.forToolProfile(toolB, { systemVersion: 1, createdAt: NOW }),
      },
    });
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.turningDetail?.toolChangeAccounting.initialToolLoads).toBe(1);
    expect(breakdown.turningDetail?.toolChangeAccounting.interFeatureToolChanges).toBe(1);
  });

  it("Scénář 16: stejný nástroj ve dvou featurech za sebou nezaloží zbytečnou výměnu", () => {
    const i = input([
      longitudinalFeature({ id: "feature:a", sequence: 0, toolProfileId: "tool:1" }),
      longitudinalFeature({ id: "feature:b", sequence: 1, toolProfileId: "tool:1" }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile(), "feature:a"));
    expect(breakdown.turningDetail?.toolChangeAccounting.initialToolLoads).toBe(1);
    expect(breakdown.turningDetail?.toolChangeAccounting.interFeatureToolChanges).toBe(0);
  });

  it("Scénář 17: výměna nástroje kvůli životnosti v kusech", () => {
    const tool = toolProfile({ toolLife: ToolLifeProfile.ofPieces(5) });
    const i = input([longitudinalFeature()], { quantity: 20 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(breakdown.turningDetail?.toolChangeAccounting.wearReplacements).toBeGreaterThan(0);
  });

  it("Scénář 18: výměna nástroje kvůli životnosti v minutách", () => {
    const tool = toolProfile({ toolLife: ToolLifeProfile.ofMinutes(1) });
    const i = input([longitudinalFeature()], { quantity: 50 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), tool));
    expect(breakdown.turningDetail?.toolChangeAccounting.wearReplacements).toBeGreaterThan(0);
  });

  it("Scénář 19: otáčky omezené maxRpm stroje", () => {
    const machine = machineProfile({ maxRpm: 100 });
    const i = input([longitudinalFeature({ cuttingConditionOverride: { cuttingSpeedMMin: 500 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.turningDetail?.features[0].spindleSpeedRpm).toBe(100);
    expect(breakdown.turningDetail?.warnings.some((w) => w.code === "RPM_CLAMPED_TO_MACHINE_LIMIT")).toBe(true);
  });

  it("Scénář 20: otáčky pod minRpm stroje (warning, beze změny hodnoty)", () => {
    const machine = machineProfile({ minRpm: 2000 });
    const i = input([longitudinalFeature({ cuttingConditionOverride: { cuttingSpeedMMin: 10 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.turningDetail?.warnings.some((w) => w.code === "RPM_BELOW_MACHINE_MINIMUM")).toBe(true);
  });

  it("Scénář 21: nevhodný nástroj pro materiál vrátí warning, ne blokující chybu", () => {
    const tool = toolProfile({ suitableMaterialGroupIds: ["material-group:hlinik"] });
    const i = input([longitudinalFeature()]);
    const ctx = contextWithMachineAndTool(machineProfile(), tool);
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.turningDetail?.warnings.some((w) => w.code === "TOOL_MATERIAL_MISMATCH")).toBe(true);
  });

  it("Scénář 22: překročení výkonu stroje", () => {
    const machine = machineProfile({ maxPowerKw: 0.5 });
    const i = input([longitudinalFeature({ passStrategy: { roughingDepthOfCutMm: 4 }, cuttingConditionOverride: { cuttingSpeedMMin: 300, feedPerRevolutionMm: 0.5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(breakdown.turningDetail?.warnings.some((w) => w.code === "MACHINE_POWER_EXCEEDED")).toBe(true);
  });

  it("Scénář 23: překročení pracovního prostoru je blokující chyba", () => {
    const machine = machineProfile({ workEnvelope: MachineWorkEnvelope.create({ maxDiameterMm: 20 }) });
    const i = input([longitudinalFeature()]);
    const issues = strategy.validate(i, contextWithMachineAndTool(machine, toolProfile()));
    expect(issues.some((iss) => iss.code === "WORK_ENVELOPE_EXCEEDED" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 24: quantity = 1", () => {
    const i = input([longitudinalFeature()], { quantity: 1 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 25: quantity = 1000", () => {
    const i = input([longitudinalFeature()], { quantity: 1000 });
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 26: monotonicita podle quantity (víc kusů = víc času)", () => {
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    const times = [1, 10, 100, 1000].map((quantity) => strategy.calculate(input([longitudinalFeature()], { quantity }), ctx).totalOperationTime.minutes);
    for (let idx = 1; idx < times.length; idx++) {
      expect(times[idx]).toBeGreaterThan(times[idx - 1]);
    }
  });

  it("Scénář 27: determinismus - stejný vstup dá stejný výsledek", () => {
    const i = input([longitudinalFeature()]);
    const ctx = contextWithMachineAndTool(machineProfile(), toolProfile());
    const first = strategy.calculate(i, ctx);
    const second = strategy.calculate(i, ctx);
    expect(first.toJSON()).toEqual(second.toJSON());
  });

  it("Scénář 31: breakdown obsahuje všechny featury", () => {
    const i = input([
      longitudinalFeature({ id: "f1", sequence: 0 }),
      longitudinalFeature({ id: "f2", sequence: 1 }),
      longitudinalFeature({ id: "f3", sequence: 2 }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    expect(breakdown.turningDetail?.features.map((f) => f.featureId)).toEqual(["f1", "f2", "f3"]);
  });

  it("Scénář 32: každý parametr má uložený zdroj", () => {
    const i = input([longitudinalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const source = breakdown.turningDetail!.features[0].sourceOfEachResolvedParameter;
    expect(source.cuttingSpeed).toBeDefined();
    expect(source.feedPerRevolution).toBeDefined();
    expect(source.spindleSpeed).toBeDefined();
    expect(source.passCount).toBeDefined();
  });

  it("Scénář 33: confidence klesne při použití systémových defaultů", () => {
    const i = input([longitudinalFeature()]);
    const withContext = strategy.calculate(i, contextWithMachineAndTool(machineProfile(), toolProfile()));
    const withoutContext = strategy.calculate(i, context());
    expect(withoutContext.turningDetail!.confidenceScore).toBeLessThan(withContext.turningDetail!.confidenceScore);
  });
});
