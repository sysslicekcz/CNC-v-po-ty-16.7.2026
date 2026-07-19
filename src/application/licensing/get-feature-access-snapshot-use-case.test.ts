import { describe, it, expect } from "vitest";
import { GetFeatureAccessSnapshotUseCase } from "./get-feature-access-snapshot-use-case";
import { DefaultFeatureAccessService } from "./default-feature-access-service";
import { Tenant, TenantStatus } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License } from "@/domain/licensing/license";
import { FeatureCodes } from "@/domain/licensing/feature-code";

const TENANT_ID = "tenant:snapshot-test";

function fakeTenantContext(): TenantContext {
  return { getCurrentTenantId: () => TENANT_ID, requireCurrentTenantId: () => TENANT_ID };
}

function fakeTenantRepository(status: TenantStatus): TenantRepository {
  const tenant = Tenant.create({ id: TENANT_ID, code: TenantCode.create("SNAP"), name: "Snapshot org", status });
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

describe("GetFeatureAccessSnapshotUseCase", () => {
  it("sestaví přístup pro VŠECHNY FeatureCode a odpovídá skutečné licenci", async () => {
    const license = License.create({
      id: "license:snap",
      tenantId: TENANT_ID,
      planCode: "plan",
      status: "active",
      validFrom: new Date(0).toISOString(),
      features: [
        { code: FeatureCodes.MachinesView, access: "full" },
        { code: FeatureCodes.RoutingEdit, access: "read" },
      ],
      limits: [],
      issuedAt: new Date(0).toISOString(),
    });
    const featureAccessService = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository("active"),
      fakeLicenseProvider(license)
    );
    const useCase = new GetFeatureAccessSnapshotUseCase(fakeTenantContext(), fakeTenantRepository("active"), featureAccessService);

    const snapshot = await useCase.execute();

    expect(snapshot.tenantId).toBe(TENANT_ID);
    expect(snapshot.tenantActive).toBe(true);
    expect(snapshot.access[FeatureCodes.MachinesView]).toBe("full");
    expect(snapshot.access[FeatureCodes.RoutingEdit]).toBe("read");
    expect(snapshot.access[FeatureCodes.IntegrationErpSync]).toBe("none");
    expect(snapshot.licenseError).toBeUndefined();
    // Musí obsahovat záznam pro úplně každý FeatureCode z katalogu.
    expect(Object.keys(snapshot.access)).toHaveLength(Object.keys(FeatureCodes).length);
  });

  it("při chybě vyhodnocení licence (neaktivní tenant) vrátí všechny funkce jako 'none' a vyplní licenseError", async () => {
    const license = License.create({
      id: "license:snap-2",
      tenantId: TENANT_ID,
      planCode: "plan",
      status: "active",
      validFrom: new Date(0).toISOString(),
      features: [{ code: FeatureCodes.MachinesView, access: "full" }],
      limits: [],
      issuedAt: new Date(0).toISOString(),
    });
    const suspendedTenantRepo = fakeTenantRepository("suspended");
    const featureAccessService = new DefaultFeatureAccessService(
      fakeTenantContext(),
      suspendedTenantRepo,
      fakeLicenseProvider(license)
    );
    const useCase = new GetFeatureAccessSnapshotUseCase(fakeTenantContext(), suspendedTenantRepo, featureAccessService);

    const snapshot = await useCase.execute();

    expect(snapshot.access[FeatureCodes.MachinesView]).toBe("none");
    expect(snapshot.licenseError).toBeDefined();
    expect(snapshot.tenantActive).toBe(false);
  });
});
