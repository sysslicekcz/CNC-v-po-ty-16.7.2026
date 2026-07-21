import { describe, it, expect } from "vitest";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { RuleVersion } from "@/domain/calculation-engine/rules/rule-version";
import { CalculationContext } from "@/domain/calculation-engine/contracts/calculation-context";
import { InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { GrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/grinding-calculation-strategy";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { GrindingFeature } from "@/domain/calculation-engine/grinding/grinding-feature";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineProfileSnapshot } from "@/domain/calculation-engine/profiles/machine-profile-snapshot";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolProfileSnapshot } from "@/domain/calculation-engine/profiles/tool-profile-snapshot";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import { InMemoryDomainEventPublisher } from "@/infrastructure/calculation-engine/in-memory-domain-event-publisher";
import { GrindingCalculationContextBuilderPort } from "../grinding-calculation-context-builder";
import { CalculateCylindricalGrindingOperationUseCase } from "./calculate-cylindrical-grinding-operation-use-case";
import { RecalculateGrindingOperationUseCase } from "./recalculate-grinding-operation-use-case";
import { CompareGrindingMachinesUseCase } from "./compare-grinding-machines-use-case";
import { CompareGrindingWheelsUseCase } from "./compare-grinding-wheels-use-case";

const TENANT_ID = "tenant:acme";
const NOW = "2025-01-01T00:00:00.000Z";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

function fullAccessFeatureService(deniedCodes: readonly string[] = []): FeatureAccessService {
  return {
    getAccess: async () => "full",
    canUse: async () => true,
    require: async (feature: FeatureCode) => {
      if (deniedCodes.includes(feature)) throw new FeatureNotLicensedError(feature);
    },
    getLimit: async () => null,
    assertWithinLimit: async () => {},
  };
}

function ruleVersion(): RuleVersion {
  return RuleVersion.create({ id: "rv:1", tenantId: TENANT_ID, version: "1", status: "active", publishedAt: NOW, constants: {} });
}

function feature(overrides: Partial<GrindingFeature> = {}): GrindingFeature {
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

function grindingInput(overrides: Partial<GrindingCalculationInput> = {}): GrindingCalculationInput {
  return { operationCategory: "grinding", operationTypeId: "op-type:grinding", quantity: 10, materialId: "material:1", machineId: "machine:1", features: [feature()], ...overrides };
}

function engineWithGrindingStrategy(): DefaultCalculationEngine {
  const registry = new InMemoryCalculationStrategyRegistry();
  registry.register(new GrindingCalculationStrategy());
  return new DefaultCalculationEngine(registry);
}

function fakeCalculationRepository(): CalculationRepository {
  const requests = new Map<string, CalculationRequest>();
  const results = new Map<string, CalculationResult>();
  return {
    saveRequest: async (request) => {
      requests.set(request.id, request);
    },
    findRequestById: async (id, tenantId) => {
      const r = requests.get(id);
      return r && r.tenantId === tenantId ? r : null;
    },
    findRequestByIdempotencyKey: async (idempotencyKey, tenantId) => {
      return [...requests.values()].find((r) => r.idempotencyKey === idempotencyKey && r.tenantId === tenantId) ?? null;
    },
    saveResult: async (result) => {
      results.set(result.id, result);
    },
    findResultById: async (id, tenantId) => {
      const r = results.get(id);
      return r && r.tenantId === tenantId ? r : null;
    },
    findResultsByRequestId: async (calculationRequestId, tenantId) => {
      return [...results.values()]
        .filter((r) => r.calculationRequestId === calculationRequestId && r.tenantId === tenantId)
        .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
    },
  };
}

function machineProfileWithPerformance(performanceCoefficient: number): MachineProfile {
  return MachineProfile.create({
    id: `machine-profile:${performanceCoefficient}`,
    tenantId: TENANT_ID,
    externalReferences: [],
    physicalMachineId: "machine:1",
    machineCategory: "grinding",
    maxRpm: 5000,
    maxPowerKw: 10,
    availableFunctions: [],
    powerCoefficient: performanceCoefficient,
    ageCoefficient: 1,
    conditionCoefficient: 1,
    typicalSetupTimes: [],
    recordVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function wheelProfileWithId(id: string): ToolProfile {
  return ToolProfile.create({
    id,
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:grinding-wheel",
    toolTypeName: "Brusný kotouč",
    diameterMm: 300,
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

describe("CalculateCylindricalGrindingOperationUseCase - Scénář 35: chybějící calculation.grinding oprávnění", () => {
  it("vyhodí FeatureNotLicensedError, pokud tenant nemá 'calculation.grinding'", async () => {
    const useCase = new CalculateCylindricalGrindingOperationUseCase(
      tenantContext(),
      fakeCalculationRepository(),
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      engineWithGrindingStrategy(),
      fullAccessFeatureService(["calculation.grinding"]),
      new InMemoryDomainEventPublisher()
    );

    await expect(useCase.execute({ ...grindingInput(), idempotencyKey: "idem-1" })).rejects.toThrow(FeatureNotLicensedError);
  });
});

describe("RecalculateGrindingOperationUseCase - Scénář 33: stará revize se po přepočtu nezmění", () => {
  it("vytvoří novou revizi, stará zůstane beze změny svých vlastních dat", async () => {
    const calculationRepository = fakeCalculationRepository();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const contextBuilder: GrindingCalculationContextBuilderPort = { build: async () => context };
    const engine = engineWithGrindingStrategy();

    const request = CalculationRequest.create({
      id: "calc-req:1",
      tenantId: TENANT_ID,
      operationCategory: "grinding",
      operationTypeId: "op-type:grinding",
      idempotencyKey: "idem-1",
      inputSnapshot: {},
      ruleVersionId: "rv:1",
      requestedAt: NOW,
    });
    await calculationRepository.saveRequest(request);

    const outcome = engine.calculate(grindingInput(), context);
    const originalResult = CalculationResult.create({
      id: "calc:1",
      tenantId: TENANT_ID,
      calculationRequestId: request.id,
      status: "completed",
      breakdown: outcome.breakdown,
      confidenceScore: outcome.breakdown?.grindingDetail?.confidenceScore,
      issues: [],
      engineVersion: engine.engineVersion,
      strategyVersion: outcome.strategyVersion,
      ruleVersionId: "rv:1",
      calculatedAt: NOW,
    });
    await calculationRepository.saveResult(originalResult);
    const originalTotalTime = originalResult.finalOperationTime.minutes;

    const useCase = new RecalculateGrindingOperationUseCase(
      tenantContext(),
      calculationRepository,
      contextBuilder,
      engine,
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    await useCase.execute({ ...grindingInput(), idempotencyKey: "idem-2", previousCalculationResultId: "calc:1" });

    const supersededOriginal = await calculationRepository.findResultById("calc:1", TENANT_ID);
    expect(supersededOriginal?.isSuperseded).toBe(true);
    expect(supersededOriginal?.finalOperationTime.minutes).toBeCloseTo(originalTotalTime);

    const allResults = await calculationRepository.findResultsByRequestId(request.id, TENANT_ID);
    expect(allResults).toHaveLength(2);
    const newResult = allResults.find((r) => r.id !== "calc:1");
    expect(newResult?.supersedesResultId).toBe("calc:1");
  });
});

describe("Scénář 34: výpočet probíhá čistě synchronně (offline schopnost)", () => {
  it("GrindingCalculationStrategy.calculate() vrací hodnotu přímo, ne Promise - žádná síťová závislost", () => {
    const strategy = new GrindingCalculationStrategy();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const result = strategy.calculate(grindingInput(), context);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.totalOperationTime.minutes).toBeGreaterThan(0);
  });
});

describe("CompareGrindingMachinesUseCase - Scénář 40: vrátí pořadí podle času", () => {
  it("seřadí stroje podle celkového času vzestupně", async () => {
    const contextBuilder: GrindingCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const performanceCoefficient = options?.machineProfileIdOverride === "machine-profile:slow" ? 3 : 1;
        const machine = machineProfileWithPerformance(performanceCoefficient);
        return {
          ruleVersion: ruleVersion(),
          machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
        };
      },
    };

    const useCase = new CompareGrindingMachinesUseCase(
      tenantContext(),
      contextBuilder,
      engineWithGrindingStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: grindingInput(),
      machineProfileIds: ["machine-profile:1", "machine-profile:slow"],
    });

    expect(results[0].machineProfileId).toBe("machine-profile:1");
    expect(results[1].machineProfileId).toBe("machine-profile:slow");
    expect(results[1].timeDeltaMinutes).toBeGreaterThan(0);
  });
});

describe("CompareGrindingWheelsUseCase - Scénář 41: vrátí pořadí podle času", () => {
  it("seřadí kotouče podle celkového času vzestupně", async () => {
    const contextBuilder: GrindingCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const wheelProfileId = options?.wheelProfileIdOverrideByFeatureId?.["feature:1"];
        const wheel = wheelProfileWithId(wheelProfileId ?? "wheel:1");
        return {
          ruleVersion: ruleVersion(),
          toolProfileSnapshotsByFeatureId: { "feature:1": ToolProfileSnapshot.forToolProfile(wheel, { systemVersion: 1, createdAt: NOW }) },
        };
      },
    };

    const useCase = new CompareGrindingWheelsUseCase(
      tenantContext(),
      contextBuilder,
      engineWithGrindingStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: grindingInput(),
      featureId: "feature:1",
      wheelProfileIds: ["wheel:a", "wheel:b"],
    });

    expect(results.map((r) => r.wheelProfileId).sort()).toEqual(["wheel:a", "wheel:b"]);
    expect(results[0].totalOperationTimeMinutes).toBeLessThanOrEqual(results[1].totalOperationTimeMinutes ?? Infinity);
  });
});
