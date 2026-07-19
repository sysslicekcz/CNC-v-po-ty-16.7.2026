import { describe, it, expect, beforeEach } from "vitest";
import { CreateMaterialGroupUseCase } from "./create-material-group-use-case";
import { DeactivateMaterialGroupUseCase } from "./deactivate-material-group-use-case";
import { CreateMaterialUseCase } from "./create-material-use-case";
import { UpdateMaterialUseCase } from "./update-material-use-case";
import { DeactivateMaterialUseCase } from "./deactivate-material-use-case";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";
import { ValidationError } from "@/domain/errors/validation-error";
import { IndexedDbMaterialGroupRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-group-repository";
import { IndexedDbMaterialRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:material-use-cases";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

function stubFeatureAccessService(options: { access?: FeatureAccess } = {}): FeatureAccessService {
  const access = options.access ?? "full";
  return {
    getAccess: async () => access,
    canUse: async () => access !== "none",
    require: async (feature: FeatureCode, requiredAccess: FeatureAccess = "read") => {
      if (access === "none") throw new FeatureNotLicensedError(feature);
      const rank: Record<FeatureAccess, number> = { none: 0, read: 1, write: 2, full: 3 };
      if (rank[access] < rank[requiredAccess]) throw new FeatureNotLicensedError(feature);
    },
    getLimit: async () => null,
    assertWithinLimit: async () => {},
  };
}

describe("CreateMaterialGroupUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí materiálovou skupinu", async () => {
    const repo = new IndexedDbMaterialGroupRepository();
    const created = await new CreateMaterialGroupUseCase(tenantContext(), repo, stubFeatureAccessService()).execute({
      code: "STEEL",
      name: "Konstrukční ocel",
    });
    expect(created.status).toBe("active");
  });

  it("zamítne duplicitní kód skupiny", async () => {
    const repo = new IndexedDbMaterialGroupRepository();
    const create = new CreateMaterialGroupUseCase(tenantContext(), repo, stubFeatureAccessService());
    await create.execute({ code: "STEEL", name: "Konstrukční ocel" });
    await expect(create.execute({ code: "STEEL", name: "Jiný název" })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });
});

describe("CreateMaterialUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí materiál patřící do existující skupiny", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();

    const group = await new CreateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute({ code: "STEEL", name: "Konstrukční ocel" });
    const material = await new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute({
      code: "S235JR",
      name: "S235JR",
      materialGroupId: group.id,
      densityKgPerM3: 7850,
    });
    expect(material.materialGroupId).toBe(group.id);
  });

  it("vyhodí NotFoundError pro neexistující materiálovou skupinu", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();
    await expect(
      new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute({ code: "X", name: "X", materialGroupId: "neexistuje" })
    ).rejects.toThrow(NotFoundError);
  });

  it("zamítne zápornou hustotu/tvrdost (entita, ne jen use case)", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();
    const group = await new CreateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute({ code: "STEEL", name: "Ocel" });

    await expect(
      new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute({
        code: "X",
        name: "X",
        materialGroupId: group.id,
        densityKgPerM3: -1,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("zamítne duplicitní kód materiálu v rámci tenanta", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();
    const group = await new CreateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute({ code: "STEEL", name: "Ocel" });
    const create = new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas);
    await create.execute({ code: "S235JR", name: "S235JR", materialGroupId: group.id });
    await expect(create.execute({ code: "S235JR", name: "Jiný", materialGroupId: group.id })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });
});

describe("Update/Deactivate Material a MaterialGroup", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("aktualizace materiálu beze změny id, deaktivace zachová záznam", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();
    const group = await new CreateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute({ code: "STEEL", name: "Ocel" });
    const material = await new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute({
      code: "S235JR",
      name: "S235JR",
      materialGroupId: group.id,
    });

    const updated = await new UpdateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute(material.id, { standard: "EN 10025-2" });
    expect(updated.id).toBe(material.id);
    expect(updated.standard).toBe("EN 10025-2");

    await new DeactivateMaterialUseCase(tenantContext(), materialRepo, fas).execute(material.id);
    const found = await materialRepo.findById(material.id, TENANT_ID);
    expect(found?.status).toBe("inactive");
  });

  it("deaktivace materiálové skupiny nesmaže materiály, které do ní patří", async () => {
    const groupRepo = new IndexedDbMaterialGroupRepository();
    const materialRepo = new IndexedDbMaterialRepository();
    const fas = stubFeatureAccessService();
    const group = await new CreateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute({ code: "STEEL", name: "Ocel" });
    const material = await new CreateMaterialUseCase(tenantContext(), materialRepo, groupRepo, fas).execute({
      code: "S235JR",
      name: "S235JR",
      materialGroupId: group.id,
    });

    await new DeactivateMaterialGroupUseCase(tenantContext(), groupRepo, fas).execute(group.id);
    const stillThere = await materialRepo.findById(material.id, TENANT_ID);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.materialGroupId).toBe(group.id);
  });
});
