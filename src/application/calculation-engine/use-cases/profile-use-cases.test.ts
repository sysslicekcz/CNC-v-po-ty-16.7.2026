import { describe, it, expect } from "vitest";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { CrossTenantAccessError } from "@/domain/calculation-engine/errors/cross-tenant-access-error";
import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MaterialProfile } from "@/domain/calculation-engine/profiles/material-profile";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineWorkEnvelope } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import { InMemoryDomainEventPublisher } from "@/infrastructure/calculation-engine/in-memory-domain-event-publisher";
import { UpdateMaterialProfileUseCase } from "./update-material-profile-use-case";
import { CompareMachineProfilesUseCase } from "./compare-machine-profiles-use-case";
import { MachineProfileResolver } from "../resolvers/machine-profile-resolver";

const TENANT_ID = "tenant:acme";
const OTHER_TENANT_ID = "tenant:other";

function tenantContext(tenantId = TENANT_ID): TenantContext {
  return { getCurrentTenantId: () => tenantId, requireCurrentTenantId: () => tenantId };
}

function fullAccessFeatureService(): FeatureAccessService {
  return {
    getAccess: async () => "full",
    canUse: async () => true,
    require: async () => {},
    getLimit: async () => null,
    assertWithinLimit: async () => {},
  };
}

function systemMaterialProfile(tenantId = TENANT_ID): MaterialProfile {
  return MaterialProfile.create({
    id: "material:1", tenantId, sourceType: "system", name: "Ocel 11 523",
    materialGroupId: "material-group:1", materialGroupName: "Konstrukční oceli", materialCoefficient: 1,
    recommendedCuttingSpeeds: [], recommendedFeeds: [], suitableToolTypeIds: [], dataSource: "master-data:material",
    externalReferences: [], recordVersion: 1, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z",
  });
}

/** In-memory fake `MaterialProfileRepository` - schválně umí simulovat i
 *  chybnou implementaci (viz `crossTenantLeak`), abychom mohli otestovat, že
 *  Application vrstva NEspoléhá jen na repozitář, ale sama chybu odhalí. */
function fakeMaterialProfileRepository(options: { crossTenantLeak?: boolean } = {}): MaterialProfileRepository {
  const store = new Map<string, MaterialProfile>();
  store.set("material:1", systemMaterialProfile(options.crossTenantLeak ? OTHER_TENANT_ID : TENANT_ID));
  const corrections = new Map<string, MaterialCorrection>();

  return {
    getById: async (id) => store.get(id) ?? null,
    findByExternalReference: async () => null,
    listByTenant: async (tenantId) => [...store.values()].filter((p) => p.tenantId === tenantId),
    save: async (profile) => {
      store.set(profile.id, profile);
    },
    archive: async (id, tenantId, archivedAt) => {
      const existing = store.get(id);
      if (existing) store.set(id, existing.archive(archivedAt));
    },
    getVersion: async (id) => store.get(id)?.recordVersion ?? null,
    getSnapshot: async () => null,
    findCorrectionByProfileId: async (materialProfileId) => corrections.get(materialProfileId) ?? null,
    saveCorrection: async (correction) => {
      corrections.set(correction.materialProfileId, correction);
    },
  };
}

describe("UpdateMaterialProfileUseCase - Scénář 18: cross-tenant přístup je odmítnut", () => {
  it("vyhodí CrossTenantAccessError, i kdyby repozitář (chybně) vrátil záznam jiného tenanta", async () => {
    const useCase = new UpdateMaterialProfileUseCase(
      tenantContext(TENANT_ID),
      fakeMaterialProfileRepository({ crossTenantLeak: true }),
      fullAccessFeatureService(),
      new InMemoryDomainEventPublisher()
    );

    await expect(
      useCase.execute({ materialProfileId: "material:1", expectedVersion: 1, changes: { name: "Nový název" } })
    ).rejects.toThrow(CrossTenantAccessError);
  });

  it("běžná aktualizace (stejný tenant) projde a vyvolá 'material_profile.updated'", async () => {
    const eventPublisher = new InMemoryDomainEventPublisher();
    const useCase = new UpdateMaterialProfileUseCase(
      tenantContext(TENANT_ID),
      fakeMaterialProfileRepository(),
      fullAccessFeatureService(),
      eventPublisher
    );

    const result = await useCase.execute({ materialProfileId: "material:1", expectedVersion: 1, changes: { name: "Nový název" } });
    expect(result.name).toBe("Nový název");
    expect(eventPublisher.publishedEvents()[0]?.type).toBe("material_profile.updated");
  });
});

function systemMachineProfile(id: string, overrides: Partial<Parameters<typeof MachineProfile.create>[0]> = {}): MachineProfile {
  return MachineProfile.create({
    id, tenantId: TENANT_ID, externalReferences: [], physicalMachineId: `physical:${id}`, availableFunctions: [],
    powerCoefficient: 1, ageCoefficient: 1, conditionCoefficient: 1, typicalSetupTimes: [], recordVersion: 1,
    createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z", ...overrides,
  });
}

function fakeMachineProfileRepository(profiles: MachineProfile[]): MachineProfileRepository {
  const store = new Map(profiles.map((p) => [p.id, p]));
  return {
    getById: async (id) => store.get(id) ?? null,
    findByExternalReference: async () => null,
    listByTenant: async (tenantId) => [...store.values()].filter((p) => p.tenantId === tenantId),
    save: async (profile) => {
      store.set(profile.id, profile);
    },
    archive: async (id, _tenantId, archivedAt) => {
      const existing = store.get(id);
      if (existing) store.set(id, existing.archive(archivedAt));
    },
    getVersion: async (id) => store.get(id)?.recordVersion ?? null,
    getSnapshot: async () => null,
    findCorrectionByProfileId: async () => null,
    saveCorrection: async () => {},
  };
}

describe("CompareMachineProfilesUseCase", () => {
  it("porovná jednu operaci napříč více stroji - nevyhovující stroj dostane eligible:false, ne výjimku", async () => {
    const smallEnvelope = MachineWorkEnvelope.create({ maxDiameterMm: 100 });
    const repo = fakeMachineProfileRepository([
      systemMachineProfile("machine-profile:big", { maxRpm: 6000 }),
      systemMachineProfile("machine-profile:small", { maxRpm: 6000, workEnvelope: smallEnvelope }),
    ]);
    const useCase = new CompareMachineProfilesUseCase(
      tenantContext(TENANT_ID),
      new MachineProfileResolver(repo),
      fullAccessFeatureService()
    );

    const results = await useCase.execute({
      machineProfileIds: ["machine-profile:big", "machine-profile:small"],
      requirements: { requestedRpm: 3000, partDimensions: { maxDiameterMm: 250 } },
    });

    expect(results.find((r) => r.machineProfileId === "machine-profile:big")?.eligible).toBe(true);
    expect(results.find((r) => r.machineProfileId === "machine-profile:small")?.eligible).toBe(false);
  });
});
