import { describe, it, expect } from "vitest";
import { DefaultFeatureAccessService } from "./default-feature-access-service";
import { Tenant, TenantStatus } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License, LicenseStatus, LicensedFeature, LicenseLimit } from "@/domain/licensing/license";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import {
  FeatureNotLicensedError,
  LicenseExpiredError,
  LicenseSuspendedError,
  ReadOnlyLicenseError,
  LicenseLimitExceededError,
  TenantNotActiveError,
} from "@/domain/errors/license-errors";

const TENANT_ID = "tenant:test";

function fakeTenantContext(): TenantContext {
  return {
    getCurrentTenantId: () => TENANT_ID,
    requireCurrentTenantId: () => TENANT_ID,
  };
}

function fakeTenantRepository(status: TenantStatus): TenantRepository {
  const tenant = Tenant.create({ id: TENANT_ID, code: TenantCode.create("TEST"), name: "Testovací organizace", status });
  return {
    findById: async (id) => (id === TENANT_ID ? tenant : null),
    findByCode: async () => null,
    findAll: async () => [tenant],
    save: async () => {},
    delete: async () => {},
  };
}

function fakeLicenseProvider(license: License): LicenseProvider {
  return { getCurrentLicense: async () => license };
}

function buildLicense(overrides: Partial<{
  status: LicenseStatus;
  validFrom: string;
  validUntil: string;
  features: LicensedFeature[];
  limits: LicenseLimit[];
}> = {}): License {
  return License.create({
    id: "license:test",
    tenantId: TENANT_ID,
    planCode: "test-plan",
    status: overrides.status ?? "active",
    validFrom: overrides.validFrom ?? new Date(0).toISOString(),
    validUntil: overrides.validUntil,
    features: overrides.features ?? [{ code: FeatureCodes.MachinesManage, access: "write" }],
    limits: overrides.limits ?? [],
    issuedAt: new Date(0).toISOString(),
  });
}

describe("DefaultFeatureAccessService - přístup k funkcím", () => {
  it("povolí funkci, kterou licence uvádí s dostatečnou úrovní přístupu", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense())
    );
    await expect(service.require(FeatureCodes.MachinesManage, "write")).resolves.not.toThrow();
    expect(await service.canUse(FeatureCodes.MachinesManage, "write")).toBe(true);
  });

  it("zamítne funkci, která v licenci vůbec není uvedená (FeatureNotLicensedError)", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ features: [] }))
    );
    await expect(service.require(FeatureCodes.MachinesManage)).rejects.toThrow(FeatureNotLicensedError);
    expect(await service.canUse(FeatureCodes.MachinesManage)).toBe(false);
  });

  it("zamítne zápis, když licence funkci povoluje jen 'read' (ReadOnlyLicenseError)", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ features: [{ code: FeatureCodes.RoutingEdit, access: "read" }] }))
    );
    await expect(service.require(FeatureCodes.RoutingEdit, "write")).rejects.toThrow(ReadOnlyLicenseError);
  });

  it("zamítne přístup pro neaktivního tenanta (TenantNotActiveError), bez ohledu na licenci", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("suspended"),
      fakeLicenseProvider(buildLicense())
    );
    await expect(service.require(FeatureCodes.MachinesManage)).rejects.toThrow(TenantNotActiveError);
  });

  it("zamítne přístup pro pozastavenou licenci (LicenseSuspendedError)", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ status: "suspended" }))
    );
    await expect(service.require(FeatureCodes.MachinesManage)).rejects.toThrow(LicenseSuspendedError);
  });

  it("zamítne přístup pro vypršelou licenci mimo grace period (LicenseExpiredError)", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(
        buildLicense({ status: "expired", validUntil: new Date(Date.now() - 86_400_000).toISOString() })
      )
    );
    await expect(service.require(FeatureCodes.MachinesManage)).rejects.toThrow(LicenseExpiredError);
  });

  it("zamítne přístup, když je licence mimo platnost (validUntil v minulosti), i když status je 'active'", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ validUntil: new Date(Date.now() - 1000).toISOString() }))
    );
    await expect(service.require(FeatureCodes.MachinesManage)).rejects.toThrow(LicenseExpiredError);
  });
});

describe("DefaultFeatureAccessService - limity", () => {
  it("povolí hodnotu pod limitem i přesně na limitu", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ limits: [{ code: "machines.max", value: 5 }] }))
    );
    await expect(service.assertWithinLimit("machines.max", 3)).resolves.not.toThrow();
    await expect(service.assertWithinLimit("machines.max", 5)).resolves.not.toThrow();
  });

  it("odmítne hodnotu nad limitem s LicenseLimitExceededError obsahující limit i požadovanou hodnotu", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ limits: [{ code: "machines.max", value: 5 }] }))
    );
    await expect(service.assertWithinLimit("machines.max", 6)).rejects.toMatchObject({
      limitCode: "machines.max",
      limit: 5,
      requestedValue: 6,
    });
    await expect(service.assertWithinLimit("machines.max", 6)).rejects.toBeInstanceOf(LicenseLimitExceededError);
  });

  it("bez uvedeného limitu v licenci je hodnota neomezená (getLimit vrátí null, assertWithinLimit projde)", async () => {
    const service = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ limits: [] }))
    );
    expect(await service.getLimit("machines.max")).toBeNull();
    await expect(service.assertWithinLimit("machines.max", 999_999)).resolves.not.toThrow();
  });

  it("snížení limitu v licenci samo o sobě nic nemaže - jen zamítne PŘÍŠTÍ požadavek nad novým limitem", async () => {
    // Licence dnes dovoluje 10 strojů, tenant jich má 8 -> nový limit se sníží na 5.
    // FeatureAccessService o existujících datech nic neví a nic sám neodstraňuje -
    // to je odpovědnost (chybějící) use-case vrstvy pro mazání, ne licence.
    const serviceWithLowerLimit = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(buildLicense({ limits: [{ code: "machines.max", value: 5 }] }))
    );
    // Assert nad limitem (např. založení 9. stroje, když už jich je 8) selže,
    // ale to je jediný efekt - žádné mazání se odnikud nevolá.
    await expect(serviceWithLowerLimit.assertWithinLimit("machines.max", 9)).rejects.toThrow(LicenseLimitExceededError);
  });
});
