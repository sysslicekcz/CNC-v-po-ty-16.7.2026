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
import { SurfaceGrindingCalculationStrategy } from "./surface-grinding-calculation-strategy";
import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingFeature } from "./grinding-feature";

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
    name: "Ocel 14 220 (kalená)",
    materialGroupId: "material-group:ocel-kalena",
    materialGroupName: "Kalené oceli",
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

function machineProfile(overrides: Partial<Parameters<typeof MachineProfile.create>[0]> = {}): MachineProfile {
  return MachineProfile.create({
    id: "machine-profile:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    physicalMachineId: "machine:1",
    machineCategory: "grinding",
    maxPowerKw: 10,
    positioningAccuracyMm: 0.002,
    rapidTraverseRateMmMin: 8000,
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

function wheelProfile(overrides: Partial<Parameters<typeof ToolProfile.create>[0]> = {}): ToolProfile {
  return ToolProfile.create({
    id: "wheel:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:grinding-wheel",
    toolTypeName: "Brusný kotouč",
    diameterMm: 200,
    widthMm: 20,
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
  return { ruleVersion: ruleVersion(), materialProfileSnapshot: MaterialProfileSnapshot.forMaterialProfile(materialProfile(), { systemVersion: 1, createdAt: NOW }), ...overrides };
}

function contextWithMachineAndWheel(machine: MachineProfile, wheel?: ToolProfile, featureId = "feature:1"): CalculationContext {
  return context({
    machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
    toolProfileSnapshotsByFeatureId: wheel ? { [featureId]: ToolProfileSnapshot.forToolProfile(wheel, { systemVersion: 1, createdAt: NOW }) } : undefined,
  });
}

function surfaceFeature(overrides: Partial<GrindingFeature> = {}): GrindingFeature {
  return {
    id: "feature:1",
    sequence: 0,
    subtype: "surface_reciprocating",
    machiningMode: "roughing",
    geometry: { surfaceLengthMm: 200, surfaceWidthMm: 50, stockAllowanceMm: 0.1, approachLengthMm: 5, retractLengthMm: 5 },
    wheelProfileId: "wheel:1",
    passStrategy: { infeedPerPassMm: 0.02, crossFeedMm: 15 },
    ...overrides,
  };
}

function input(features: GrindingFeature[], overrides: Partial<GrindingCalculationInput> = {}): GrindingCalculationInput {
  return { operationCategory: "grinding", operationTypeId: "op-type:grinding", quantity: 10, materialId: "material:1", machineId: "machine:1", features, ...overrides };
}

const strategy = new SurfaceGrindingCalculationStrategy();

function assertNoBlockingErrors(issues: ReturnType<SurfaceGrindingCalculationStrategy["validate"]>) {
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
}

describe("SurfaceGrindingCalculationStrategy", () => {
  it("Scénář 11: rovinné broušení jedné plochy jedním příčným průchodem (šířka <= crossFeed)", () => {
    const i = input([surfaceFeature({ passStrategy: { infeedPerPassMm: 0.02, crossFeedMm: 60 } })]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile({ widthMm: 60 }));
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.grindingDetail?.features[0].crossFeedMm).toBe(60);
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 12: rovinné broušení více přejezdy (crossPasses > 1)", () => {
    const i = input([surfaceFeature({ passStrategy: { infeedPerPassMm: 0.02, crossFeedMm: 15 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features[0].totalStrokes).toBeGreaterThan(2);
  });

  it("Scénář 13: více hloubkových vrstev (depthLayers podle stockAllowance/infeed)", () => {
    const i = input([surfaceFeature({ geometry: { surfaceLengthMm: 200, surfaceWidthMm: 50, stockAllowanceMm: 0.1, approachLengthMm: 5, retractLengthMm: 5 }, passStrategy: { infeedPerPassMm: 0.02, crossFeedMm: 60 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features[0].finishingPasses).toBe(5);
  });

  it("Scénář 14: creep-feed aproximace - jedna hloubková vrstva, označená jako approximation", () => {
    const i = input([surfaceFeature({ subtype: "surface_creep_feed", geometry: { surfaceLengthMm: 150, surfaceWidthMm: 40, stockAllowanceMm: 2, approachLengthMm: 5, retractLengthMm: 5 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.approximationType).toBe("creep_feed");
    expect(feature.finishingPasses).toBe(1);
    expect(feature.warnings.some((w) => w.code === "CREEP_FEED_RESULT_APPROXIMATED")).toBe(true);
  });

  it("Scénář 39: confidence klesne při creep-feed aproximaci", () => {
    const withoutCreepFeed = strategy.calculate(input([surfaceFeature()]), contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const withCreepFeed = strategy.calculate(
      input([surfaceFeature({ subtype: "surface_creep_feed", geometry: { surfaceLengthMm: 150, surfaceWidthMm: 40, stockAllowanceMm: 2, approachLengthMm: 5, retractLengthMm: 5 } })]),
      contextWithMachineAndWheel(machineProfile(), wheelProfile())
    );
    expect(withCreepFeed.grindingDetail!.confidenceScore).toBeLessThan(withoutCreepFeed.grindingDetail!.confidenceScore);
  });

  it("rovinné broušení s obrácením dílu přidá pomocný čas", () => {
    const without = strategy.calculate(input([surfaceFeature()]), contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const withReversal = strategy.calculate(input([surfaceFeature({ partReversalRequired: true })]), contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(withReversal.totalOperationTime.minutes).toBeGreaterThan(without.totalOperationTime.minutes);
  });

  it("neplatná geometrie plochy vrátí INVALID_SURFACE_GEOMETRY", () => {
    const i = input([surfaceFeature({ geometry: { surfaceLengthMm: 0, surfaceWidthMm: 0, stockAllowanceMm: 0.1, approachLengthMm: 1, retractLengthMm: 1 } })]);
    const issues = strategy.validate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(issues.some((iss) => iss.code === "INVALID_SURFACE_GEOMETRY" && iss.severity === "error")).toBe(true);
  });

  it("determinismus - stejný vstup dá stejný výsledek", () => {
    const i = input([surfaceFeature()]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    expect(strategy.calculate(i, ctx).toJSON()).toEqual(strategy.calculate(i, ctx).toJSON());
  });
});
