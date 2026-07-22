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
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { TurningFeature } from "@/domain/calculation-engine/turning/turning-feature";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineProfileSnapshot } from "@/domain/calculation-engine/profiles/machine-profile-snapshot";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolProfileSnapshot } from "@/domain/calculation-engine/profiles/tool-profile-snapshot";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import { InMemoryDomainEventPublisher } from "@/infrastructure/calculation-engine/in-memory-domain-event-publisher";
import { TurningCalculationContextBuilderPort } from "../turning-calculation-context-builder";
import { CalculateTurningOperationUseCase } from "./calculate-turning-operation-use-case";
import { RecalculateTurningOperationUseCase } from "./recalculate-turning-operation-use-case";
import { CompareTurningMachinesUseCase } from "./compare-turning-machines-use-case";
import { CompareTurningToolsUseCase } from "./compare-turning-tools-use-case";

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

function feature(overrides: Partial<TurningFeature> = {}): TurningFeature {
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

function turningInput(overrides: Partial<TurningCalculationInput> = {}): TurningCalculationInput {
  return {
    operationCategory: "turning",
    operationTypeId: "op-type:turning",
    quantity: 10,
    materialId: "material:1",
    machineId: "machine:1",
    features: [feature()],
    ...overrides,
  };
}

function engineWithTurningStrategy(): DefaultCalculationEngine {
  const registry = new InMemoryCalculationStrategyRegistry();
  registry.register(new TurningCalculationStrategy());
  return new DefaultCalculationEngine(registry);
}

/** In-memory fake `CalculationRepository` - dost pro use-case testy, žádná
 *  skutečná perzistence (ta má vlastní testy v `infrastructure/calculation-
 *  engine/*.test.ts`). */
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
    listResultsByTenant: async (tenantId) => {
      return [...results.values()].filter((r) => r.tenantId === tenantId);
    },
  };
}

function machineProfileWithPerformance(performanceCoefficient: number): MachineProfile {
  return MachineProfile.create({
    id: `machine-profile:${performanceCoefficient}`,
    tenantId: TENANT_ID,
    externalReferences: [],
    physicalMachineId: "machine:1",
    machineCategory: "lathe",
    maxRpm: 4000,
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

describe("CalculateTurningOperationUseCase - Scénář 30: chybějící calculation.turning oprávnění", () => {
  it("vyhodí FeatureNotLicensedError, pokud tenant nemá 'calculation.turning'", async () => {
    const useCase = new CalculateTurningOperationUseCase(
      tenantContext(),
      fakeCalculationRepository(),
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      engineWithTurningStrategy(),
      fullAccessFeatureService(["calculation.turning"]),
      new InMemoryDomainEventPublisher()
    );

    await expect(useCase.execute({ ...turningInput(), idempotencyKey: "idem-1" })).rejects.toThrow(FeatureNotLicensedError);
  });
});

describe("RecalculateTurningOperationUseCase - Scénář 28: stará revize se po přepočtu nezmění", () => {
  it("vytvoří novou revizi, stará zůstane beze změny svých vlastních dat", async () => {
    const calculationRepository = fakeCalculationRepository();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const contextBuilder: TurningCalculationContextBuilderPort = { build: async () => context };
    const engine = engineWithTurningStrategy();

    const request = CalculationRequest.create({
      id: "calc-req:1",
      tenantId: TENANT_ID,
      operationCategory: "turning",
      operationTypeId: "op-type:turning",
      idempotencyKey: "idem-1",
      inputSnapshot: {},
      ruleVersionId: "rv:1",
      requestedAt: NOW,
    });
    await calculationRepository.saveRequest(request);

    const outcome = engine.calculate(turningInput(), context);
    const originalResult = CalculationResult.create({
      id: "calc:1",
      tenantId: TENANT_ID,
      calculationRequestId: request.id,
      status: "completed",
      breakdown: outcome.breakdown,
      confidenceScore: outcome.breakdown?.turningDetail?.confidenceScore,
      issues: [],
      engineVersion: engine.engineVersion,
      strategyVersion: outcome.strategyVersion,
      ruleVersionId: "rv:1",
      calculatedAt: NOW,
    });
    await calculationRepository.saveResult(originalResult);
    const originalTotalTime = originalResult.finalOperationTime.minutes;

    const useCase = new RecalculateTurningOperationUseCase(
      tenantContext(),
      calculationRepository,
      contextBuilder,
      engine,
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    await useCase.execute({ ...turningInput(), idempotencyKey: "idem-2", previousCalculationResultId: "calc:1" });

    const supersededOriginal = await calculationRepository.findResultById("calc:1", TENANT_ID);
    expect(supersededOriginal?.isSuperseded).toBe(true);
    expect(supersededOriginal?.finalOperationTime.minutes).toBeCloseTo(originalTotalTime);

    const allResults = await calculationRepository.findResultsByRequestId(request.id, TENANT_ID);
    expect(allResults).toHaveLength(2);
    const newResult = allResults.find((r) => r.id !== "calc:1");
    expect(newResult?.supersedesResultId).toBe("calc:1");
  });
});

describe("Scénář 29: výpočet probíhá čistě synchronně (offline schopnost)", () => {
  it("TurningCalculationStrategy.calculate() vrací hodnotu přímo, ne Promise - žádná síťová závislost", () => {
    const strategy = new TurningCalculationStrategy();
    const context: CalculationContext = { ruleVersion: ruleVersion() };
    const result = strategy.calculate(turningInput(), context);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.totalOperationTime.minutes).toBeGreaterThan(0);
  });
});

describe("CompareTurningMachinesUseCase - Scénář 34: vrátí pořadí podle času", () => {
  it("seřadí stroje podle celkového času vzestupně", async () => {
    const contextBuilder: TurningCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const performanceCoefficient = options?.machineProfileIdOverride === "machine-profile:slow" ? 3 : 1;
        const machine = machineProfileWithPerformance(performanceCoefficient);
        return {
          ruleVersion: ruleVersion(),
          machineProfileSnapshot: MachineProfileSnapshot.forMachineProfile(machine, { systemVersion: 1, createdAt: NOW }),
        };
      },
    };

    const useCase = new CompareTurningMachinesUseCase(
      tenantContext(),
      contextBuilder,
      engineWithTurningStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: turningInput(),
      machineProfileIds: ["machine-profile:1", "machine-profile:slow"],
    });

    expect(results[0].machineProfileId).toBe("machine-profile:1");
    expect(results[1].machineProfileId).toBe("machine-profile:slow");
    expect(results[1].timeDeltaMinutes).toBeGreaterThan(0);
  });
});

describe("CompareTurningToolsUseCase - Scénář 35: vrátí pořadí podle času", () => {
  it("seřadí nástroje podle celkového času vzestupně", async () => {
    const contextBuilder: TurningCalculationContextBuilderPort = {
      build: async (_input, _tenantId, options) => {
        const toolProfileId = options?.toolProfileIdOverrideByFeatureId?.["feature:1"];
        const tool = toolProfileWithId(toolProfileId ?? "tool:1");
        return {
          ruleVersion: ruleVersion(),
          toolProfileSnapshotsByFeatureId: { "feature:1": ToolProfileSnapshot.forToolProfile(tool, { systemVersion: 1, createdAt: NOW }) },
        };
      },
    };

    const useCase = new CompareTurningToolsUseCase(
      tenantContext(),
      contextBuilder,
      engineWithTurningStrategy(),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    const results = await useCase.execute({
      input: turningInput(),
      featureId: "feature:1",
      toolProfileIds: ["tool:a", "tool:b"],
    });

    expect(results.map((r) => r.toolProfileId).sort()).toEqual(["tool:a", "tool:b"]);
    expect(results[0].totalOperationTimeMinutes).toBeLessThanOrEqual(results[1].totalOperationTimeMinutes ?? Infinity);
  });
});
