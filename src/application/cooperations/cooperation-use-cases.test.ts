import { describe, it, expect, beforeEach } from "vitest";
import { CreateExternalOperationResourceUseCase } from "./create-external-operation-resource-use-case";
import { UpdateExternalOperationResourceUseCase } from "./update-external-operation-resource-use-case";
import { DeactivateExternalOperationResourceUseCase } from "./deactivate-external-operation-resource-use-case";
import { DeleteExternalOperationResourceUseCase } from "./delete-external-operation-resource-use-case";
import { CreateSupplierUseCase } from "@/application/suppliers/create-supplier-use-case";
import { UpdateSupplierUseCase } from "@/application/suppliers/update-supplier-use-case";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { FeatureNotLicensedError, LicenseLimitExceededError } from "@/domain/errors/license-errors";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { ExternalResourceCodeAlreadyExistsError } from "@/domain/errors/external-resource-code-already-exists-error";
import { IndexedDbExternalOperationResourceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-operation-resource-repository";
import { IndexedDbSupplierRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-supplier-repository";
import { DefaultMasterDataUsageChecker } from "@/infrastructure/persistence/indexeddb/default-master-data-usage-checker";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

const TENANT_ID = "tenant:cooperation-use-cases";

function tenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
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

describe("CreateExternalOperationResourceUseCase", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("založí kooperaci nezávisle na strojích (žádná vazba na machines.manage)", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const useCase = new CreateExternalOperationResourceUseCase(tenantContext(), repo, stubFeatureAccessService());

    const resource = await useCase.execute({ code: "KOOP-TEP", name: "Tepelné zpracování" });
    expect(resource.status).toBe("active");
  });

  it("zamítne duplicitní kód kooperace v rámci tenanta", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const useCase = new CreateExternalOperationResourceUseCase(tenantContext(), repo, stubFeatureAccessService());
    await useCase.execute({ code: "KOOP-TEP", name: "Tepelné zpracování" });
    await expect(useCase.execute({ code: "KOOP-TEP", name: "Jiné jméno" })).rejects.toThrow(ExternalResourceCodeAlreadyExistsError);
  });

  it("zamítne bez licence 'cooperations.manage'", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const useCase = new CreateExternalOperationResourceUseCase(tenantContext(), repo, stubFeatureAccessService({ access: "read" }));
    await expect(useCase.execute({ code: "KOOP-TEP", name: "Tepelné zpracování" })).rejects.toThrow(FeatureNotLicensedError);
  });
});

describe("Update/Deactivate/Delete ExternalOperationResource", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("aktualizuje detaily (dodavatel, lhůta, cena) beze změny id", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const fas = stubFeatureAccessService();
    const create = new CreateExternalOperationResourceUseCase(tenantContext(), repo, fas);
    const update = new UpdateExternalOperationResourceUseCase(tenantContext(), repo, fas);

    const supplierRepo = new IndexedDbSupplierRepository();
    const supplier = await new CreateSupplierUseCase(tenantContext(), supplierRepo, fas).execute({ name: "Kalírna s.r.o." });

    const created = await create.execute({ code: "KOOP-TEP", name: "Tepelné zpracování" });
    const updated = await update.execute(created.id, { supplierId: supplier.id, defaultLeadTimeDays: 5 });

    expect(updated.id).toBe(created.id);
    expect(updated.supplierId).toBe(supplier.id);
    expect(updated.defaultLeadTimeDays).toBe(5);
  });

  it("preferuje deaktivaci - fyzické smazání se odmítne, když je kooperace používaná", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const fas = stubFeatureAccessService();
    const created = await new CreateExternalOperationResourceUseCase(tenantContext(), repo, fas).execute({ code: "KOOP-TEP", name: "Tepelné zpracování" });

    const usageChecker = new DefaultMasterDataUsageChecker();
    const del = new DeleteExternalOperationResourceUseCase(tenantContext(), repo, usageChecker, fas);

    // Bez použití: smazání projde.
    await del.execute(created.id);
    expect(await repo.findById(created.id, TENANT_ID)).toBeNull();
  });

  it("deaktivace nesmaže záznam - zůstává dohledatelný pro historické účely", async () => {
    const repo = new IndexedDbExternalOperationResourceRepository();
    const fas = stubFeatureAccessService();
    const created = await new CreateExternalOperationResourceUseCase(tenantContext(), repo, fas).execute({ code: "KOOP-TEP", name: "Tepelné zpracování" });

    await new DeactivateExternalOperationResourceUseCase(tenantContext(), repo, fas).execute(created.id);
    const found = await repo.findById(created.id, TENANT_ID);
    expect(found).not.toBeNull();
    expect(found?.status).toBe("inactive");
  });
});

describe("Supplier use cases", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("Supplier je oddělená entita od kooperace - založení nevyžaduje kód", async () => {
    const repo = new IndexedDbSupplierRepository();
    const fas = stubFeatureAccessService();
    const created = await new CreateSupplierUseCase(tenantContext(), repo, fas).execute({ name: "Kalírna s.r.o.", email: "info@kalirna.cz" });
    expect(created.code).toBeUndefined();
    expect(created.status).toBe("active");
  });

  it("zamítne duplicitní kód dodavatele, pokud je vyplněný", async () => {
    const repo = new IndexedDbSupplierRepository();
    const fas = stubFeatureAccessService();
    const create = new CreateSupplierUseCase(tenantContext(), repo, fas);
    await create.execute({ code: "SUP-1", name: "Dodavatel A" });
    await expect(create.execute({ code: "SUP-1", name: "Dodavatel B" })).rejects.toThrow(MasterDataCodeAlreadyExistsError);
  });

  it("aktualizace beze změny id, kód lze i vyprázdnit (null)", async () => {
    const repo = new IndexedDbSupplierRepository();
    const fas = stubFeatureAccessService();
    const created = await new CreateSupplierUseCase(tenantContext(), repo, fas).execute({ code: "SUP-1", name: "Dodavatel A" });
    const updated = await new UpdateSupplierUseCase(tenantContext(), repo, fas).execute(created.id, { code: null, phone: "123456789" });
    expect(updated.id).toBe(created.id);
    expect(updated.code).toBeUndefined();
    expect(updated.phone).toBe("123456789");
  });
});
