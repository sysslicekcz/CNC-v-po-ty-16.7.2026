import { describe, it, expect, beforeEach } from "vitest";
import { DefaultFeatureAccessService } from "@/application/licensing/default-feature-access-service";
import { Tenant, DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License } from "@/domain/licensing/license";
import { connectorFeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { FeatureNotLicensedError } from "@/domain/errors/license-errors";
import { ExternalSystem } from "@/domain/integrations/external-system";
import { ExternalReference } from "@/domain/integrations/external-reference";
import { IndexedDbExternalSystemRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-system-repository";
import { IndexedDbExternalReferenceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-reference-repository";
import { deleteTpvDbForTests } from "@/infrastructure/persistence/indexeddb/tpv-db";

function fakeTenantContext(): TenantContext {
  return { getCurrentTenantId: () => DEFAULT_TENANT_ID, requireCurrentTenantId: () => DEFAULT_TENANT_ID };
}

function fakeTenantRepository(): TenantRepository {
  const tenant = Tenant.create({ id: DEFAULT_TENANT_ID, code: TenantCode.create("T"), name: "Test org", status: "active" });
  return {
    findById: async (id) => (id === DEFAULT_TENANT_ID ? tenant : null),
    findByCode: async () => null,
    findAll: async () => [tenant],
    save: async () => {},
    delete: async () => {},
  };
}

function fakeLicenseProvider(license: License): LicenseProvider {
  return { getCurrentLicense: async () => license };
}

describe("Odebrání licence konektoru nesmaže importovaná data", () => {
  beforeEach(async () => {
    await deleteTpvDbForTests();
  });

  it("FeatureAccessService odmítne connector.helios, ale ExternalReference/ExternalSystem zůstávají beze změny", async () => {
    const systems = new IndexedDbExternalSystemRepository();
    const references = new IndexedDbExternalReferenceRepository();

    const erpSystem = ExternalSystem.create({
      id: "sys-helios",
      tenantId: DEFAULT_TENANT_ID,
      code: "HELIOS-MAIN",
      name: "Helios",
      type: "erp",
      connectorType: "helios",
      status: "active",
    });
    await systems.save(erpSystem);

    const now = new Date().toISOString();
    await references.save(
      ExternalReference.create({
        id: "ref-1",
        tenantId: DEFAULT_TENANT_ID,
        externalSystemId: erpSystem.id,
        localEntityType: "machine",
        localEntityId: "machine-1",
        externalEntityType: "workplace",
        externalId: "300-58140",
        createdAt: now,
        updatedAt: now,
      })
    );

    // Licence BEZ connector.helios (= "licence konektoru byla odebrána").
    const licenseWithoutConnector = License.create({
      id: "license:test",
      tenantId: DEFAULT_TENANT_ID,
      planCode: "test-plan",
      status: "active",
      validFrom: new Date(0).toISOString(),
      features: [{ code: FeatureCodes.IntegrationErpView, access: "full" }],
      limits: [],
      issuedAt: new Date(0).toISOString(),
    });
    const featureAccessService = new DefaultFeatureAccessService(
      fakeTenantContext(),
      fakeTenantRepository(),
      fakeLicenseProvider(licenseWithoutConnector)
    );

    await expect(featureAccessService.require(connectorFeatureCode("helios"))).rejects.toThrow(FeatureNotLicensedError);

    // Data z dřívějšího importu zůstávají čitelná a nezměněná - repository o
    // licenci vůbec neví, žádné mazání/kaskáda se nekoná.
    const stillThere = await references.findById("ref-1", DEFAULT_TENANT_ID);
    expect(stillThere).not.toBeNull();
    expect(stillThere?.externalId).toBe("300-58140");
    expect(await systems.findById("sys-helios", DEFAULT_TENANT_ID)).not.toBeNull();
  });
});
