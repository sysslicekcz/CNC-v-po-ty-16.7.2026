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
import { MillingCalculationStrategy } from "@/domain/calculation-engine/milling/milling-calculation-strategy";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { MillingFeature } from "@/domain/calculation-engine/milling/milling-feature";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineProfileSnapshot } from "@/domain/calculation-engine/profiles/machine-profile-snapshot";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolProfileSnapshot } from "@/domain/calculation-engine/profiles/tool-profile-snapshot";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import { InMemoryDomainEventPublisher } from "@/infrastructure/calculation-engine/in-memory-domain-event-publisher";
import { MillingCalculationContextBuilderPort } from "../milling-calculation-context-builder";
import { CalculateMillingOperationUseCase } from "./calculate-milling-operation-use-case";
import { RecalculateMillingOperationUseCase } from "./recalculate-milling-operation-use-case";
import { CompareMillingMachinesUseCase } from "./compare-milling-machines-use-case";
import { CompareMillingToolsUseCase } from "./compare-milling-tools-use-case";

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

function feature(overrides: Partial<MillingFeature> = {}): MillingFeature {
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

function millingInput(overrides: Partial<MillingCalculationInput> = {}): MillingCalculationInput {
  return {
    operationCategory: "milling",
    operationTypeId: "op-type:milling",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features: [feature()],
    ...overrides,
  };
}

function engineWithMillingStrategy(): DefaultCalculationEngine {
  const registry = new InMemoryCalculationStrategyRegistry();
  registry.register(new MillingCalculationStrategy());
  return new DefaultCalculationEngine(registry);
}

/** In-memory fake `CalculationRepository` - stejný fake jako Fáze C
 *  `turning-use-cases.test.ts`, žádná skutečná perzistence. */
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
    machineCategory: "milling",
    maxRpm: 12000,
    maxPowerKw: 15,
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

function toolProfileWithId(id: string): ToolProfile {
  return ToolProfile.create({
    id,
    tenantId: TENANT_ID,
    externalReferences: [],
    toolTypeId: "tool-type:1",
    toolTypeName: "Stopková fréza",
    diameterMm: 10,
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

describe("CalculateMillingOperationUseCase - Scénář 38: chybějící calculation.milling oprávnění", () => {
  it("vyhodí FeatureNotLicensedError, pokud tenant nemá 'calculation.milling'", async () => {
    const useCase = new CalculateMillingOperationUseCase(
      tenantContext(),
      fakeCalculationRepository(),
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      engineWithMillingStrategy(),
      fullAccessFeatureService(["calculation.milling"]),
      new InMemoryDomainEventPublisher()
    );

    await expect(useCase.execute({ ...millingInput(), idempotencyKey: "idem-1" })).rejects.toThrow(FeatureNotLicensedError);
  });
});

describe("RecalculateMillingOperationUseCase - Scénář 36: stará revize se po přepočtu nezmění", () => {
  it("vytvoří novou revizi, stará zůstane beze změny svých vlastních dat", async () => {
    const calculationRepository = fakeCalculationRepository();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const contextBuilder: MillingCalculationContextBuilderPort = { build: async () => context };
    const engine = engineWithMillingStrategy();

    const request = CalculationRequest.create({
      id: "calc-req:1",
      tenantId: TENANT_ID,
      operationCategory: "milling",
      operationTypeId: "op-type:milling",
      idempotencyKey: "idem-1",
      inputSnapshot: {},
      ruleVersionId: "rv:1",
      requestedAt: NOW,
    });
    await calculationRepository.saveRequest(request);

    const outcome = engine.calculate(millingInput(), context);
    const originalResult = CalculationResult.create({
      id: "calc:1",
      tenantId: TENANT_ID,
      calculationRequestId: request.id,
      status: "completed",
      breakdown: outcome.breakdown,
      confidenceScore: outcome.breakdown?.millingDetail?.confidenceScore,
      issues: [],
      engineVersion: engine.engineVersion,
      strategyVersion: outcome.strategyVersion,
      ruleVersionId: "rv:1",
      calculatedAt: NOW,
    });
    await calculationRepository.saveResult(originalResult);
    const originalTotalTime = originalResult.finalOperationTime.minutes;

    const useCase = new RecalculateMillingOperationUseCase(
      tenantContext(),
      calculationRepository,
      contextBuilder,
      engine,
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    await useCase.execute({ ...millingInput(), idempotencyKey: "idem-2", previousCalculationResultId: "calc:1" });

    const supersededOriginal = await calculationRepository.findResultById("calc:1", TENANT_ID);
    expect(supersededOriginal?.isSuperseded).toBe(true);
    expect(supersededOriginal?.finalOperationTime.minutes).toBeCloseTo(originalTotalTime);

    const allResults = await calculationRepository.findResultsByRequestId(request.id, TENANT_ID);
    expect(allResults).toHaveLength(2);
    const newResult = allResults.find((r) => r.id !== "calc:1");
    expect(newResult?.supersedesResultId).toBe("calc:1");
  });
});

describe("Scénář 37: výpočet probíhá čistě synchronně (offline schopnost)", () => {
  it("MillingCalculationStrategy.calculate() vrací hodnotu přímo, ne Promise - žádná síťová závislost", () => {
    const strategy = new MillingCalculationStrategy();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const result = strategy.calculate(millingInput(), context);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.totalOperationTime.minutes).toBeGreaterThan(0);
  });
});

describe("CompareMillingMachinesUseCase - Scénář 43: vrátí pořadí podle času", () => {
  it("seřadí stroje podle celkového času vzestupně", async () => {
    const contextBuilder: MillingCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const performanceCoefficient = options?.machineProfileIdOverride === "machine-profile:slow" ? 3 : 1;
        const machine = machineProfileWithPerformance(performanceCoefficient);
        return {
          ruleVersion: ruleVersion(),
          machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
        };
      },
    };

    const useCase = new CompareMillingMachinesUseCase(
      tenantContext(),
      contextBuilder,
      engineWithMillingStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: millingInput(),
      machineProfileIds: ["machine-profile:1", "machine-profile:slow"],
    });

    expect(results[0].machineProfileId).toBe("machine-profile:1");
    expect(results[1].machineProfileId).toBe("machine-profile:slow");
    expect(results[1].timeDeltaMinutes).toBeGreaterThan(0);
  });
});

describe("CompareMillingToolsUseCase - Scénář 44: vrátí pořadí podle času", () => {
  it("seřadí nástroje podle celkového času vzestupně", async () => {
    const contextBuilder: MillingCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const toolProfileId = options?.toolProfileIdOverrideByFeatureId?.["feature:1"];
        const tool = toolProfileWithId(toolProfileId ?? "tool:1");
        return {
          ruleVersion: ruleVersion(),
          toolProfileSnapshotsByFeatureId: { "feature:1": ToolProfileSnapshot.forToolProfile(tool, { systemVersion: 1, createdAt: NOW }) },
        };
      },
    };

    const useCase = new CompareMillingToolsUseCase(
      tenantContext(),
      contextBuilder,
      engineWithMillingStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: millingInput(),
      featureId: "feature:1",
      toolProfileIds: ["tool:a", "tool:b"],
    });

    expect(results.map((r) => r.toolProfileId).sort()).toEqual(["tool:a", "tool:b"]);
    expect(results[0].totalOperationTimeMinutes).toBeLessThanOrEqual(results[1].totalOperationTimeMinutes ?? Infinity);
  });
});
