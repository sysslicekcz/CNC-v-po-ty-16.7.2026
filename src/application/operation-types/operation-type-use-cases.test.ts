import { describe, it, expect, beforeEach } from "vitest";
import { CreateOperationTypeUseCase } from "./create-operation-type-use-case";
import { UpdateOperationTypeUseCase } from "./update-operation-type-use-case";
import { DeactivateOperationTypeUseCase } from "./deactivate-operation-type-use-case";
import { ReactivateOperationTypeUseCase } from "./reactivate-operation-type-use-case";
import { ConfigureOperationTypeCapabilitiesUseCase } from "./configure-operation-type-capabilities-use-case";
import { RemoveOperationTypeCapabilityRequirementUseCase } from "./remove-operation-type-capability-requirement-use-case";
import { CreateCapabilityTypeUseCase } from "@/application/capabilities/create-capability-type-use-case";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { FeatureNotLicensedError, LicenseLimitExceededError } from "@/domain/errors/license-errors";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbCapabilityTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capability-type-repository";
import { IndexedDbOperationTypeCapabilityRequirementRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-capability-requirement-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:operation-type-use-cases";
const OTHER_TENANT_ID = "tenant:other";

function tenantContext(tenantId: string = TENANT_ID): TenantContext {
  return { getCurrentTenantId: () => tenantId, requireCurrentTenantId: () => tenantId };
}

function stubFeatureAccessService(options: { access?: FeatureAccess; limit?: number | null } = {}): FeatureAccessService {
  const access = options.access ?? "full";
  const limit = options.limit === undefined ? null : options.limit;
  return {
    getAccess: async () => access,
    canUse: async () => access !== "none",
    require: async (feature: FeatureCode, requiredAccess: FeatureAccess = "read") => {
      if (access === "none") throw new FeatureNotLicensedError(feature);
      const rank: Record<FeatureAccess, number> = { none: 0, read: 1, write: 2, full: 3 };
      if (rank[access] < rank[requiredAccess]) throw new FeatureNotLicensedError(feature);
    },
    getLimit: async () => limit,
    assertWithinLimit: async (limitCode: LicenseLimitCode, nextValue: number) => {
      if (limit !== null && nextValue > limit) throw new LicenseLimitExceededError(limitCode, limit, nextValue);
    },
  };
}

const BASE_INPUT = {
  kod: "OT-1",
  nazev: "Frézování drážek",
  kategorie: "milling" as const,
  resourceRequirement: "machine" as const,
  requiresSetupTime: true,
  requiresUnitTime: true,
};

describe("CreateOperationTypeUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí typ operace jako aktivní (dřív jen seedovaný číselník, teď editovatelná kmenová data)", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const useCase = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());

    const created = await useCase.execute(BASE_INPUT);
    expect(created.stav).toBe("aktivni");
    expect(created.tenantId).toBe(TENANT_ID);
  });

  it("zamítne duplicitní kód v rámci tenanta", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const useCase = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());

    await useCase.execute(BASE_INPUT);
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });

  it("stejný kód smí existovat nezávisle ve DVOU RŮZNÝCH tenantech (tenant isolation)", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    await new CreateOperationTypeUseCase(tenantContext(TENANT_ID), repo, stubFeatureAccessService()).execute(BASE_INPUT);
    const otherTenantCreated = await new CreateOperationTypeUseCase(tenantContext(OTHER_TENANT_ID), repo, stubFeatureAccessService()).execute(
      BASE_INPUT
    );
    expect(otherTenantCreated.tenantId).toBe(OTHER_TENANT_ID);
  });

  it("zamítne nad licenčním limitem 'operationTypes.max'", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const useCase = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService({ limit: 1 }));
    await useCase.execute(BASE_INPUT);
    await expect(useCase.execute({ ...BASE_INPUT, kod: "OT-2" })).rejects.toThrow(LicenseLimitExceededError);
  });

  it("zamítne bez licence 'operation_types.manage'", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const useCase = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService({ access: "read" }));
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(FeatureNotLicensedError);
  });
});

describe("UpdateOperationTypeUseCase + Deactivate/Reactivate", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("upraví detaily beze změny id, re-ověří unikátnost při změně kódu", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const create = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    const update = new UpdateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());

    const a = await create.execute(BASE_INPUT);
    await create.execute({ ...BASE_INPUT, kod: "OT-2" });

    const renamed = await update.execute(a.id, { nazev: "Frézování drážek (nové)" });
    expect(renamed.id).toBe(a.id);

    await expect(update.execute(a.id, { kod: "OT-2" })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });

  it("deaktivace preferovaná před smazáním - záznam po deaktivaci pořád existuje a je dohledatelný", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const create = new CreateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    const deactivate = new DeactivateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    const reactivate = new ReactivateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());

    const created = await create.execute(BASE_INPUT);
    await deactivate.execute(created.id);
    const deactivated = await repo.findById(created.id, TENANT_ID);
    expect(deactivated?.stav).toBe("neaktivni");

    await reactivate.execute(created.id);
    const reactivated = await repo.findById(created.id, TENANT_ID);
    expect(reactivated?.stav).toBe("aktivni");
  });

  it("vyhodí NotFoundError pro neexistující typ operace", async () => {
    const repo = new IndexedDbOperationTypeRepository();
    const update = new UpdateOperationTypeUseCase(tenantContext(), repo, stubFeatureAccessService());
    await expect(update.execute("neexistuje", { nazev: "X" })).rejects.toThrow(NotFoundError);
  });
});

describe("ConfigureOperationTypeCapabilitiesUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí vazbu typ operace -> capabilita, druhé volání ji jen upraví (ne duplikuje)", async () => {
    const operationTypeRepo = new IndexedDbOperationTypeRepository();
    const capabilityTypeRepo = new IndexedDbCapabilityTypeRepository();
    const requirementRepo = new IndexedDbOperationTypeCapabilityRequirementRepository();
    const fas = stubFeatureAccessService();

    const operationType = await new CreateOperationTypeUseCase(tenantContext(), operationTypeRepo, fas).execute(BASE_INPUT);
    const capabilityType = await new CreateCapabilityTypeUseCase(tenantContext(), capabilityTypeRepo, fas).execute({
      code: "MAX_DIAM",
      name: "Max. průměr",
      valueType: "number",
    });

    const configure = new ConfigureOperationTypeCapabilitiesUseCase(tenantContext(), requirementRepo, operationTypeRepo, capabilityTypeRepo, fas);
    await configure.execute({ operationTypeId: operationType.id, capabilityTypeId: capabilityType.id, requirement: "required" });
    await configure.execute({ operationTypeId: operationType.id, capabilityTypeId: capabilityType.id, requirement: "recommended", expectedValue: 500 });

    const requirements = await requirementRepo.findByOperationTypeId(operationType.id, TENANT_ID);
    expect(requirements).toHaveLength(1);
    expect(requirements[0].requirement).toBe("recommended");
    expect(requirements[0].expectedValue).toBe(500);

    const remove = new RemoveOperationTypeCapabilityRequirementUseCase(tenantContext(), requirementRepo, fas);
    await remove.execute(requirements[0].id);
    expect(await requirementRepo.findByOperationTypeId(operationType.id, TENANT_ID)).toHaveLength(0);
  });

  it("vyhodí NotFoundError pro neexistující typ operace/capabilitu", async () => {
    const operationTypeRepo = new IndexedDbOperationTypeRepository();
    const capabilityTypeRepo = new IndexedDbCapabilityTypeRepository();
    const requirementRepo = new IndexedDbOperationTypeCapabilityRequirementRepository();
    const fas = stubFeatureAccessService();
    const configure = new ConfigureOperationTypeCapabilitiesUseCase(tenantContext(), requirementRepo, operationTypeRepo, capabilityTypeRepo, fas);

    await expect(
      configure.execute({ operationTypeId: "neexistuje", capabilityTypeId: "neexistuje", requirement: "required" })
    ).rejects.toThrow(NotFoundError);
  });
});
