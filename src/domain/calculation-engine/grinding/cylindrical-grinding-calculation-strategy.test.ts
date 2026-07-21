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
import { CylindricalGrindingCalculationStrategy } from "./cylindrical-grinding-calculation-strategy";
import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingFeature } from "./grinding-feature";

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
    ...overrides,
  });
}

function machineProfile(overrides: Partial<Parameters<typeof MachineProfile.create>[0]> = {}): MachineProfile {
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

function contextWithMachineAndWheel(machine: MachineProfile, wheel?: ToolProfile, featureId = "feature:1"): CalculationContext {
  return context({
    machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
    toolProfileSnapshotsByFeatureId: wheel ? { [featureId]: ToolProfileSnapshot.forToolProfile(wheel, { systemVersion: 1, createdAt: NOW }) } : undefined,
  });
}

function externalFeature(overrides: Partial<GrindingFeature> = {}): GrindingFeature {
  return {
    id: "feature:1",
    sequence: 0,
    subtype: "external_cylindrical",
    machiningMode: "roughing",
    geometry: { startDiameterMm: 50, endDiameterMm: 49.5, grindingLengthMm: 100, stockAllowanceMm: 0.25, approachLengthMm: 5, retractLengthMm: 5 },
    wheelProfileId: "wheel:1",
    passStrategy: { roughingInfeedPerPassMm: 0.05 },
    ...overrides,
  };
}

function input(features: GrindingFeature[], overrides: Partial<GrindingCalculationInput> = {}): GrindingCalculationInput {
  return {
    operationCategory: "grinding",
    operationTypeId: "op-type:grinding",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features,
    ...overrides,
  };
}

const strategy = new CylindricalGrindingCalculationStrategy();

function assertNoBlockingErrors(issues: ReturnType<CylindricalGrindingCalculationStrategy["validate"]>) {
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
}

describe("CylindricalGrindingCalculationStrategy", () => {
  it("Scénář 1: jednoduché vnější broušení", () => {
    const i = input([externalFeature()]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
    expect(breakdown.grindingDetail?.features).toHaveLength(1);
  });

  it("Scénář 2: více hrubovacích průchodů (radialStock 0.25mm, infeed 0.05mm -> 5 průchodů)", () => {
    const i = input([externalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features[0].roughingPasses).toBe(5);
  });

  it("Scénář 3: hrubování + dokončení (finishingAllowance odděleně)", () => {
    const i = input([externalFeature({ passStrategy: { roughingInfeedPerPassMm: 0.05, finishingAllowanceMm: 0.05, finishingInfeedPerPassMm: 0.01 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.roughingPasses).toBeGreaterThan(0);
    expect(feature.finishingPasses).toBe(5);
  });

  it("Scénář 4: spark-out průchody se počítají do totalPasses", () => {
    const i = input([externalFeature({ passStrategy: { roughingInfeedPerPassMm: 0.05, sparkOutPasses: 3 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.sparkOutPasses).toBe(3);
    expect(feature.totalPasses).toBe(feature.roughingPasses + feature.finishingPasses + 3);
    expect(feature.sparkOutContributionMin).toBeGreaterThan(0);
  });

  it("Scénář 5: vnitřní broušení", () => {
    const i = input([externalFeature({ subtype: "internal_cylindrical", geometry: { startDiameterMm: 20, endDiameterMm: 20.5, grindingLengthMm: 40, stockAllowanceMm: 0.25, approachLengthMm: 3, retractLengthMm: 3 } })]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.grindingDetail?.features[0].subtype).toBe("internal_cylindrical");
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 6: čelní broušení", () => {
    const i = input([
      externalFeature({ subtype: "face_grinding", geometry: { startDiameterMm: 60, stockAllowanceMm: 0.1, axialAllowanceMm: 0.1, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.subtype).toBe("face_grinding");
    expect(feature.axialStockMm).toBeCloseTo(0.1);
  });

  it("Scénář 7: plunge grinding", () => {
    const i = input([
      externalFeature({ subtype: "plunge_grinding", geometry: { startDiameterMm: 40, endDiameterMm: 39.6, grindingLengthMm: 20, stockAllowanceMm: 0.2, approachLengthMm: 2, retractLengthMm: 2 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features[0].rawGrindingTimeMin).toBeGreaterThan(0);
  });

  it("Scénář 8: traverse grinding", () => {
    const i = input([externalFeature({ subtype: "traverse_grinding" })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.effectiveStrokeLengthMm).toBeCloseTo(110);
    expect(feature.totalStrokes).toBeGreaterThan(0);
  });

  it("Scénář 9: centerless through-feed aproximace", () => {
    const i = input([
      externalFeature({ subtype: "centerless_through_feed", geometry: { startDiameterMm: 10, endDiameterMm: 10, grindingLengthMm: 300, stockAllowanceMm: 0.1, approachLengthMm: 0, retractLengthMm: 0 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const feature = breakdown.grindingDetail!.features[0];
    expect(feature.approximationType).toBe("centerless");
    expect(feature.warnings.some((w) => w.code === "CENTERLESS_RESULT_APPROXIMATED")).toBe(true);
  });

  it("Scénář 10: centerless in-feed aproximace", () => {
    const i = input([
      externalFeature({ subtype: "centerless_in_feed", geometry: { startDiameterMm: 15, endDiameterMm: 14.7, grindingLengthMm: 25, stockAllowanceMm: 0.15, approachLengthMm: 1, retractLengthMm: 1 } }),
    ]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features[0].approximationType).toBe("centerless");
  });

  it("Scénář 15: víc GrindingFeature v jedné operaci, pořadí zachováno", () => {
    const i = input([externalFeature({ id: "feature:b", sequence: 1 }), externalFeature({ id: "feature:a", sequence: 0 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features.map((f) => f.featureId)).toEqual(["feature:a", "feature:b"]);
  });

  it("Scénář 16: změna upnutí se počítá do plannedFixtureChanges", () => {
    const i = input([externalFeature({ fixtureChangeCount: 2 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.plannedFixtureChanges).toBe(2);
  });

  it("Scénář 17: orovnání před prvním kusem (initialDressings)", () => {
    const i = input([externalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.wheelDressingAccounting.initialDressings).toBe(1);
  });

  it("Scénář 18: intervalové orovnání podle počtu kusů", () => {
    const i = input([externalFeature({ dressingStrategy: { dressingIntervalPieces: 5 } })], { quantity: 20 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.wheelDressingAccounting.intervalDressings).toBe(4);
  });

  it("Scénář 19: intervalové orovnání podle času broušení", () => {
    const i = input([externalFeature({ dressingStrategy: { dressingIntervalMinutes: 0.01 } })], { quantity: 20 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.wheelDressingAccounting.intervalDressings).toBeGreaterThan(0);
  });

  it("Scénář 20: výměna kotouče podle životnosti", () => {
    const wheel = wheelProfile({ toolLife: ToolLifeProfile.ofPieces(3) });
    const i = input([externalFeature()], { quantity: 20 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheel));
    expect(breakdown.grindingDetail?.wheelChangeAccounting.wearReplacements).toBeGreaterThan(0);
  });

  it("Scénář 21: měření každého kusu", () => {
    const i = input([externalFeature({ measurementRequirement: "every_piece", measurementTimeMin: 0.5 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.measurementTimeMin).toBeCloseTo(0.5);
  });

  it("Scénář 22: měření každého N-tého kusu", () => {
    const i = input([externalFeature({ measurementFrequencyPieces: 4, measurementTimeMin: 1 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.measurementTimeMin).toBeCloseTo(0.25);
  });

  it("Scénář 23: korekční průchod po měření je explicitní a zvyšuje čas", () => {
    const withoutCorrection = strategy.calculate(
      input([externalFeature({ measurementRequirement: "every_piece", measurementTimeMin: 0.5 })]),
      contextWithMachineAndWheel(machineProfile(), wheelProfile())
    );
    const withCorrection = strategy.calculate(
      input([externalFeature({ measurementRequirement: "every_piece", measurementTimeMin: 0.5, correctionPassOnDeviation: true, correctionPassTimeMin: 0.3 })]),
      contextWithMachineAndWheel(machineProfile(), wheelProfile())
    );
    expect(withCorrection.totalOperationTime.minutes).toBeGreaterThan(withoutCorrection.totalOperationTime.minutes);
  });

  it("Scénář 24: max wheel speed - blokující chyba při překročení", () => {
    const wheel = wheelProfile({ maxCuttingSpeedMMin: 1800 });
    const i = input([externalFeature({ cuttingConditionOverride: { wheelSpeedMps: 45 } })]);
    const issues = strategy.validate(i, contextWithMachineAndWheel(machineProfile(), wheel));
    expect(issues.some((iss) => iss.code === "WHEEL_SPEED_EXCEEDS_LIMIT" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 25: nevhodný kotouč pro materiál vrátí warning, ne blokující chybu", () => {
    const wheel = wheelProfile({ suitableMaterialGroupIds: ["material-group:hlinik"] });
    const i = input([externalFeature()]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheel);
    assertNoBlockingErrors(strategy.validate(i, ctx));
    const breakdown = strategy.calculate(i, ctx);
    expect(breakdown.grindingDetail?.warnings.some((w) => w.code === "WHEEL_MATERIAL_MISMATCH")).toBe(true);
  });

  it("Scénář 26: nedostatečná přesnost stroje je blokující chyba pro dokončovací feature", () => {
    const machine = machineProfile({ positioningAccuracyMm: 0.02 });
    const i = input([externalFeature({ machiningMode: "finishing" })]);
    const issues = strategy.validate(i, contextWithMachineAndWheel(machine, wheelProfile()));
    expect(issues.some((iss) => iss.code === "PRECISION_CAPABILITY_INSUFFICIENT" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 27: překročení výkonu stroje", () => {
    const machine = machineProfile({ maxPowerKw: 0.001 });
    const i = input([externalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machine, wheelProfile()));
    expect(breakdown.grindingDetail?.warnings.some((w) => w.code === "MACHINE_POWER_EXCEEDED")).toBe(true);
  });

  it("Scénář 28: překročení pracovního prostoru je blokující chyba", () => {
    const machine = machineProfile({ workEnvelope: MachineWorkEnvelope.create({ maxDiameterMm: 10 }) });
    const i = input([externalFeature()]);
    const issues = strategy.validate(i, contextWithMachineAndWheel(machine, wheelProfile()));
    expect(issues.some((iss) => iss.code === "WORK_ENVELOPE_EXCEEDED" && iss.severity === "error")).toBe(true);
  });

  it("Scénář 29: quantity = 1", () => {
    const i = input([externalFeature()], { quantity: 1 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 30: quantity = 1000", () => {
    const i = input([externalFeature()], { quantity: 1000 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.totalOperationTime.minutes).toBeGreaterThan(0);
  });

  it("Scénář 31: monotonicita podle quantity (víc kusů = víc času)", () => {
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    const times = [1, 10, 100, 1000].map((quantity) => strategy.calculate(input([externalFeature()], { quantity }), ctx).totalOperationTime.minutes);
    for (let idx = 1; idx < times.length; idx++) {
      expect(times[idx]).toBeGreaterThan(times[idx - 1]);
    }
  });

  it("Scénář 32: determinismus - stejný vstup dá stejný výsledek", () => {
    const i = input([externalFeature()]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    const first = strategy.calculate(i, ctx);
    const second = strategy.calculate(i, ctx);
    expect(first.toJSON()).toEqual(second.toJSON());
  });

  it("Scénář 34: výpočet je čistá synchronní funkce (funguje i offline)", () => {
    const i = input([externalFeature()]);
    const ctx = contextWithMachineAndWheel(machineProfile(), wheelProfile());
    expect(strategy.calculate.constructor.name).not.toBe("AsyncFunction");
    expect(strategy.calculate(i, ctx)).toBeDefined();
  });

  it("Scénář 36: breakdown obsahuje všechny featury", () => {
    const i = input([externalFeature({ id: "f1", sequence: 0 }), externalFeature({ id: "f2", sequence: 1 }), externalFeature({ id: "f3", sequence: 2 })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.features.map((f) => f.featureId)).toEqual(["f1", "f2", "f3"]);
  });

  it("Scénář 37: každý parametr má uložený zdroj", () => {
    const i = input([externalFeature()]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const source = breakdown.grindingDetail!.features[0].sourceOfEachResolvedParameter;
    expect(source.workpieceSpeed).toBeDefined();
    expect(source.wheelSpeed).toBeDefined();
    expect(source.passCount).toBeDefined();
  });

  it("Scénář 38: confidence klesne při centerless aproximaci", () => {
    const withoutCenterless = strategy.calculate(input([externalFeature()]), contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const withCenterless = strategy.calculate(
      input([externalFeature({ subtype: "centerless_in_feed" })]),
      contextWithMachineAndWheel(machineProfile(), wheelProfile())
    );
    expect(withCenterless.grindingDetail!.confidenceScore).toBeLessThan(withoutCenterless.grindingDetail!.confidenceScore);
  });

  it("Scénář 42: orovnání (dressing) není zaměněno za výměnu kotouče - oddělené účetnictví", () => {
    const i = input([externalFeature({ dressingStrategy: { dressingIntervalPieces: 3 } })], { quantity: 12 });
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(breakdown.grindingDetail?.wheelDressingAccounting.totalDressings).toBeGreaterThan(0);
    // Kotouč beze změny (neznámá životnost -> jen initialWheelLoads), orovnání
    // se do wheelChangeAccounting vůbec nepromítne.
    expect(breakdown.grindingDetail?.wheelChangeAccounting.wearReplacements).toBe(0);
    expect(breakdown.grindingDetail?.dressingTimeMin).toBeGreaterThan(0);
    expect(breakdown.grindingDetail?.wheelReplacementTimeMin).not.toBe(breakdown.grindingDetail?.dressingTimeMin);
  });

  it("Scénář 43: removedVolume je správně vypočten (π × délka × |D1²-D2²| / 4)", () => {
    const i = input([externalFeature({ geometry: { startDiameterMm: 50, endDiameterMm: 48, grindingLengthMm: 100, stockAllowanceMm: 1, approachLengthMm: 2, retractLengthMm: 2 } })]);
    const breakdown = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const expected = (Math.PI * 100 * Math.abs(50 ** 2 - 48 ** 2)) / 4;
    expect(breakdown.grindingDetail?.features[0].removedVolumeMm3).toBeCloseTo(expected, 6);
  });

  it("Scénář 44: invalid pass count (0) vrátí blokující chybu", () => {
    const i = input([externalFeature({ passStrategy: { passCount: 0 } })]);
    const issues = strategy.validate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    expect(issues.some((iss) => iss.code === "INVALID_PASS_COUNT" && iss.severity === "error")).toBe(true);
  });

  it("confidence klesne při použití systémových defaultů (bez kontextu materiálu/stroje/kotouče)", () => {
    const i = input([externalFeature()]);
    const withContext = strategy.calculate(i, contextWithMachineAndWheel(machineProfile(), wheelProfile()));
    const withoutContext = strategy.calculate(i, context());
    expect(withoutContext.grindingDetail!.confidenceScore).toBeLessThan(withContext.grindingDetail!.confidenceScore);
  });
});
