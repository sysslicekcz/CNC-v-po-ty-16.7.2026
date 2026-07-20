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
import { TurningCalculationStrategy } from "./turning-calculation-strategy";
import { TurningCalculationInput } from "./turning-calculation-input";
import { TurningFeature } from "./turning-feature";

/**
 * Golden master testy (AP-MCE-001 Fáze C §19) - 5 referenčních
 * technologických případů se ZAMRAZENÝM očekávaným `turningDetail`. Stejný
 * vstup + stejné verze (`strategyVersion`/`algorithmVersion`) MUSÍ dát
 * byte-identický normalizovaný výstup (§19) - `toEqual` nad `JSON.parse(
 * JSON.stringify(...))` porovnává STRUKTURÁLNĚ, což je pro deterministickou
 * IEEE754 aritmetiku nad stejným vstupem ekvivalent bytové identity (žádná
 * nedeterministická složka - hodiny/náhoda/síť - ve `TurningCalculation
 * Strategy` není, viz `CalculationStrategy` "musí být čistá").
 *
 * Očekávané hodnoty jsou zaznamenané z JEDNOHO běhu téhle implementace
 * (`strategyVersion: "turning-1.0.0"`) - jakákoliv budoucí ZÁMĚRNÁ změna
 * výpočtu musí golden master vědomě aktualizovat, ne "opravit test, ať
 * projde".
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
  });
}

function toolProfile(): ToolProfile {
  return ToolProfile.create({
    id: "tool:1",
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:1",
    toolTypeName: "Nůž",
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

function baseInput(features: TurningFeature[], overrides: Partial<TurningCalculationInput> = {}): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 50,
    materialId: "material:1",
    machineId: "machine:1",
    features,
    ...overrides,
  };
}

const strategy = new TurningCalculationStrategy();

function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("TurningCalculationStrategy - golden master (AP-MCE-001 Fáze C §19)", () => {
  it("1. vnější hrubování hřídele (external_longitudinal, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_longitudinal",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 60, endDiameterMm: 50, machiningLengthMm: 200, approachLengthMm: 3, retractLengthMm: 3 },
        toolProfileId: "tool:1",
        passStrategy: { roughingDepthOfCutMm: 2.5 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.turningDetail?.totalOperationTimeMin).toBeCloseTo(177.97122382586178, 9);
    expect(breakdown.turningDetail?.confidenceScore).toBeCloseTo(0.8, 9);
    expect(breakdown.turningDetail?.features[0].roughingPasses).toBe(2);
    expect(breakdown.turningDetail?.features[0].spindleSpeedRpm).toBeCloseTo(578.7452476068921, 6);

    const second = strategy.calculate(input, context());
    expect(normalize(second.turningDetail)).toEqual(normalize(breakdown.turningDetail));
  });

  it("2. dokončení hřídele (external_longitudinal, finishing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "external_longitudinal",
        machiningMode: "finishing",
        geometry: { startDiameterMm: 50, endDiameterMm: 49, machiningLengthMm: 200, approachLengthMm: 3, retractLengthMm: 3 },
        toolProfileId: "tool:1",
        cuttingConditionOverride: { cuttingSpeedMMin: 220, feedPerRevolutionMm: 0.15 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.turningDetail?.totalOperationTimeMin).toBeCloseTo(53.39136714775855, 9);
    expect(breakdown.turningDetail?.confidenceScore).toBeCloseTo(0.9, 9);
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(1);
    expect(breakdown.turningDetail?.features[0].feedRateMmMin).toBeCloseTo(212.20659078919377, 6);

    const second = strategy.calculate(input, context());
    expect(normalize(second.turningDetail)).toEqual(normalize(breakdown.turningDetail));
  });

  it("3. vnitřní soustružení otvoru (internal_longitudinal, roughing)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "internal_longitudinal",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 30, endDiameterMm: 36, machiningLengthMm: 80, approachLengthMm: 2, retractLengthMm: 2 },
        toolProfileId: "tool:1",
        passStrategy: { roughingDepthOfCutMm: 1.5 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.turningDetail?.totalOperationTimeMin).toBeCloseTo(43.54247417875453, 9);
    expect(breakdown.turningDetail?.features[0].effectiveDiameterMm).toBe(33);
    expect(breakdown.turningDetail?.features[0].roughingPasses).toBe(2);

    const second = strategy.calculate(input, context());
    expect(normalize(second.turningDetail)).toEqual(normalize(breakdown.turningDetail));
  });

  it("4. vrtání (drilling s peck cykly)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "drilling",
        machiningMode: "roughing",
        geometry: { startDiameterMm: 12, endDiameterMm: 12, machiningLengthMm: 40, approachLengthMm: 2, retractLengthMm: 0, peckDepthMm: 15 },
        toolProfileId: "tool:1",
        cuttingConditionOverride: { cuttingSpeedMMin: 80, feedPerRevolutionMm: 0.1 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.turningDetail?.totalOperationTimeMin).toBeCloseTo(24.033183799961915, 9);
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(3);
    expect(breakdown.turningDetail?.features[0].spindleSpeedSource).toBe("start");

    const second = strategy.calculate(input, context());
    expect(normalize(second.turningDetail)).toEqual(normalize(breakdown.turningDetail));
  });

  it("5. řezání závitu (threading)", () => {
    const input = baseInput([
      {
        id: "feature:1",
        sequence: 0,
        subtype: "threading",
        machiningMode: "finishing",
        geometry: { startDiameterMm: 20, endDiameterMm: 20, machiningLengthMm: 25, approachLengthMm: 3, retractLengthMm: 3, threadPitchMm: 1.5 },
        toolProfileId: "tool:1",
        passStrategy: { passCount: 4 },
        cuttingConditionOverride: { cuttingSpeedMMin: 100 },
      },
    ]);
    const breakdown = strategy.calculate(input, context());

    expect(breakdown.turningDetail?.totalOperationTimeMin).toBeCloseTo(2.856754919664319, 9);
    expect(breakdown.turningDetail?.features[0].feedPerRevolutionMm).toBeCloseTo(1.5, 9);
    expect(breakdown.turningDetail?.features[0].totalPasses).toBe(4);

    const second = strategy.calculate(input, context());
    expect(normalize(second.turningDetail)).toEqual(normalize(breakdown.turningDetail));
  });
});
