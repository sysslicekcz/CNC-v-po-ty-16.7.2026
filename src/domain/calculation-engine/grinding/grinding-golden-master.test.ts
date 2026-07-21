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
import { CylindricalGrindingCalculationStrategy } from "./cylindrical-grinding-calculation-strategy";
import { SurfaceGrindingCalculationStrategy } from "./surface-grinding-calculation-strategy";
import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingFeature } from "./grinding-feature";

/**
 * Golden master testy (AP-MCE-001 Fáze E §22) - 6 referenčních
 * technologických případů se ZAMRAZENÝM očekávaným `grindingDetail`, stejný
 * důvod a technika jako Fáze C/D golden master testy.
 */

const NOW = "2025-01-01T00:00:00.000Z";
const TENANT_ID = "tenant:acme";

function materialProfile(): MaterialProfile {
  return MaterialProfile.create({
    id: "material:1",
    tenantId: TENANT_ID,
    sourceType: "system",
    name: "Ocel 14 220",
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

function machineProfile(): MachineProfile {
  return MachineProfile.create({
    id: "machine-profile:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    physicalMachineId: "machine:1",
    machineCategory: "grinding",
    maxRpm: 5000,
    minRpm: 20,
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
  });
}

function wheelProfile(): ToolProfile {
  return ToolProfile.create({
    id: "wheel:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:grinding-wheel",
    toolTypeName: "Brusný kotouč",
    diameterMm: 300,
    widthMm: 25,
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
  return {
    ruleVersion: RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} }),
    materialProfileSnapshot: MaterialProfileSnapshot.forMaterialProfile(materialProfile(), { systemVersion: 1, createdAt: NOW }),
    machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machineProfile(), { systemVersion: 1, createdAt: NOW }),
    toolProfileSnapshotsByFeatureId: { "feature:1": ToolProfileSnapshot.forToolProfile(wheelProfile(), { systemVersion: 1, createdAt: NOW }) },
  };
}

function baseInput(features: GrindingFeature[], overrides: Partial<GrindingCalculationInput> = {}): GrindingCalculationInput {
  return { operationCategory: "grinding", operationTypeId: "op-type:grinding", quantity: 50, materialId: "material:1", machineId: "machine:1", features, ...overrides };
}

const cylindrical = new CylindricalGrindingCalculationStrategy();
const surface = new SurfaceGrindingCalculationStrategy();

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("Grinding strategies - golden master (AP-MCE-001 Fáze E §22)", () => {
  it("1. vnější broušení hřídele (external_cylindrical, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_cylindrical",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 50, endDiameterMm: 49.5, grindingLengthMm: 150, stockAllowanceMm: 0.25, approachLengthMm: 5, retractLengthMm: 5 },
        wheelProfileId: "wheel:1",
        passStrategy: { roughingInfeedPerPassMm: 0.05 },
        cuttingConditionOverride: { workpieceSpeedRpm: 120, wheelSpeedMps: 30, tableSpeedMmMin: 3000 },
      },
    ]);
    const breakdown = cylindrical.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(31.000000000000004, 9);
    expect(breakdown.grindingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.grindingDetail?.features[0].roughingPasses).toBe(5);
    expect(breakdown.grindingDetail?.features[0].totalStrokes).toBe(10);

    const second = cylindrical.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });

  it("2. dokončovací broušení hřídele (external_cylindrical, finishing, spark-out)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_cylindrical",
        machiningMode: "finishing",
        geometry: { startDiameterMm: 50, endDiameterMm: 49.98, grindingLengthMm: 150, stockAllowanceMm: 0.01, approachLengthMm: 5, retractLengthMm: 5 },
        wheelProfileId: "wheel:1",
        passStrategy: { finishingAllowanceMm: 0.01, finishingInfeedPerPassMm: 0.005, sparkOutPasses: 2 },
        cuttingConditionOverride: { workpieceSpeedRpm: 150, wheelSpeedMps: 32, tableSpeedMmMin: 2000 },
      },
    ]);
    const breakdown = cylindrical.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(55.5, 9);
    expect(breakdown.grindingDetail?.confidenceScore).toBeCloseTo(0.85, 9);
    expect(breakdown.grindingDetail?.features[0].finishingPasses).toBe(2);
    expect(breakdown.grindingDetail?.features[0].totalPasses).toBe(5);

    const second = cylindrical.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });

  it("3. vnitřní broušení otvoru (internal_cylindrical, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "internal_cylindrical",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 20, endDiameterMm: 20.3, grindingLengthMm: 40, stockAllowanceMm: 0.15, approachLengthMm: 3, retractLengthMm: 3 },
        wheelProfileId: "wheel:1",
        passStrategy: { roughingInfeedPerPassMm: 0.03 },
        cuttingConditionOverride: { workpieceSpeedRpm: 200, wheelSpeedMps: 25, tableSpeedMmMin: 1500 },
      },
    ]);
    const breakdown = cylindrical.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(26.183999999999997, 9);
    expect(breakdown.grindingDetail?.features[0].roughingPasses).toBe(6);

    const second = cylindrical.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });

  it("4. plunge grinding", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "plunge_grinding",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 40, endDiameterMm: 39.6, grindingLengthMm: 20, stockAllowanceMm: 0.2, approachLengthMm: 2, retractLengthMm: 2 },
        wheelProfileId: "wheel:1",
        cuttingConditionOverride: { workpieceSpeedRpm: 100, wheelSpeedMps: 30, feedRateMmMin: 0.4 },
      },
    ]);
    const breakdown = cylindrical.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(29.276249999999905, 9);
    expect(breakdown.grindingDetail?.features[0].rawGrindingTimeMin).toBeCloseTo(0.5004999999999982, 9);

    const second = cylindrical.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });

  it("5. rovinné broušení plochy (surface_reciprocating)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "surface_reciprocating",
        machiningMode: "roughing",
        geometry: { surfaceLengthMm: 200, surfaceWidthMm: 50, stockAllowanceMm: 0.1, approachLengthMm: 5, retractLengthMm: 5 },
        wheelProfileId: "wheel:1",
        passStrategy: { infeedPerPassMm: 0.02, crossFeedMm: 15 },
        cuttingConditionOverride: { tableSpeedMmMin: 10000 },
      },
    ]);
    const breakdown = surface.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(59.85, 9);
    expect(breakdown.grindingDetail?.features[0].totalStrokes).toBe(40);

    const second = surface.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });

  it("6. broušení se spark-out a orovnáním (dressing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_cylindrical",
        machiningMode: "finishing",
        geometry: { startDiameterMm: 30, endDiameterMm: 29.9, grindingLengthMm: 80, stockAllowanceMm: 0.05, approachLengthMm: 3, retractLengthMm: 3 },
        wheelProfileId: "wheel:1",
        passStrategy: { finishingAllowanceMm: 0.05, finishingInfeedPerPassMm: 0.01, sparkOutPasses: 3 },
        dressingStrategy: { dressingIntervalPieces: 10, dressingTimeMin: 2 },
        cuttingConditionOverride: { workpieceSpeedRpm: 180, wheelSpeedMps: 28, tableSpeedMmMin: 2500 },
      },
    ]);
    const breakdown = cylindrical.calculate(input, context());

    expect(breakdown.grindingDetail?.totalOperationTimeMin).toBeCloseTo(52.635, 9);
    expect(breakdown.grindingDetail?.confidenceScore).toBeCloseTo(0.9, 9);
    expect(breakdown.grindingDetail?.wheelDressingAccounting.totalDressings).toBe(6);
    expect(breakdown.grindingDetail?.sparkOutTimeMin).toBeCloseTo(0.2064, 9);

    const second = cylindrical.calculate(input, context());
    expect(normalize(second.grindingDetail)).toEqual(normalize(breakdown.grindingDetail));
  });
});
