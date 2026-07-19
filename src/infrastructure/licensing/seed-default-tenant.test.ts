import { describe, it, expect, beforeEach } from "vitest";
import { ensureDefaultTenantAndLicense } from "./seed-default-tenant";
import { IndexedDbTenantRepository } from "../persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { IndexedDbLicenseRepository } from "../persistence/indexeddb/repositories/indexeddb-license-repository";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { deleteTpvDbForTests } from "../persistence/indexeddb/tpv-db";

describe("ensureDefaultTenantAndLicense", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("vytvoří výchozí lokální tenant a jeho licenci, pokud ještě neexistují", async () => {
    await ensureDefaultTenantAndLicense();

    const tenants = new IndexedDbTenantRepository();
    const licenses = new IndexedDbLicenseRepository();

    const tenant = await tenants.findById(DEFAULT_TENANT_ID);
    expect(tenant).not.toBeNull();
    expect(tenant?.isActive).toBe(true);

    const license = await licenses.findByTenantId(DEFAULT_TENANT_ID);
    expect(license).not.toBeNull();
    expect(license?.status).toBe("active");
    expect(license?.getFeatureAccess("machines.manage")).toBe("full");
  });

  it("je idempotentní - opakované volání nepřepíše ručně změněný stav", async () => {
    await ensureDefaultTenantAndLicense();

    const tenants = new IndexedDbTenantRepository();
    const tenant = await tenants.findById(DEFAULT_TENANT_ID);
    expect(tenant).not.toBeNull();
    tenant!.setStatus("suspended");
    await tenants.save(tenant!);

    await ensureDefaultTenantAndLicense();

    const afterSecondSeed = await tenants.findById(DEFAULT_TENANT_ID);
    expect(afterSecondSeed?.status).toBe("suspended");
  });

  it("je bezpečné volat vícekrát za sebou bez chyby (žádný unikátní-index konflikt)", async () => {
    await ensureDefaultTenantAndLicense();
    await expect(ensureDefaultTenantAndLicense()).resolves.not.toThrow();
    await expect(ensureDefaultTenantAndLicense()).resolves.not.toThrow();
  });
});
