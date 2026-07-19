import { LocalTenantContext } from "@/infrastructure/services/local-tenant-context";
import { IndexedDbTenantRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { LocalLicenseProvider } from "@/infrastructure/licensing/local-license-provider";
import { DevelopmentLicenseProvider } from "@/infrastructure/licensing/development-license-provider";
import { IndexedDbLicenseRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-license-repository";
import { DefaultFeatureAccessService } from "@/application/licensing/default-feature-access-service";
import { GetFeatureAccessSnapshotUseCase } from "@/application/licensing/get-feature-access-snapshot-use-case";
import { GetCurrentTenantUseCase } from "@/application/tenants/get-current-tenant-use-case";
import { IndexedDbExternalSystemRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-system-repository";
import { CreateExternalSystemUseCase } from "@/application/integrations/create-external-system-use-case";
import { ListExternalSystemsUseCase } from "@/application/integrations/list-external-systems-use-case";
import { DeactivateExternalSystemUseCase } from "@/application/integrations/deactivate-external-system-use-case";
import { ReactivateExternalSystemUseCase } from "@/application/integrations/reactivate-external-system-use-case";

/**
 * Jedna factory funkce pro sekci `/tpv/integrations` a `/tpv/settings` (Krok 6 -
 * integrace/UX dotažení) - stejný vzor jako `master-data-dependencies.ts`
 * z Kroku 5. `ExternalSystem` doména existuje od Kroku 3.5 (docs/step-3-5/erp-integration.md),
 * tahle factory ji poprvé propojuje s UI.
 */
export function createIntegrationDependencies() {
  const tenantContext = new LocalTenantContext();
  const tenantRepository = new IndexedDbTenantRepository();
  const licenseRepository = new IndexedDbLicenseRepository();
  const licenseProvider = new DevelopmentLicenseProvider(new LocalLicenseProvider(tenantContext, licenseRepository));
  const featureAccessService = new DefaultFeatureAccessService(tenantContext, tenantRepository, licenseProvider);
  const externalSystemRepository = new IndexedDbExternalSystemRepository();

  return {
    tenantContext,
    featureAccessService,
    externalSystemRepository,

    getFeatureAccessSnapshotUseCase: new GetFeatureAccessSnapshotUseCase(tenantContext, tenantRepository, featureAccessService),
    getCurrentTenantUseCase: new GetCurrentTenantUseCase(tenantContext, tenantRepository),

    createExternalSystemUseCase: new CreateExternalSystemUseCase(tenantContext, externalSystemRepository, featureAccessService),
    listExternalSystemsUseCase: new ListExternalSystemsUseCase(tenantContext, externalSystemRepository, featureAccessService),
    deactivateExternalSystemUseCase: new DeactivateExternalSystemUseCase(tenantContext, externalSystemRepository, featureAccessService),
    reactivateExternalSystemUseCase: new ReactivateExternalSystemUseCase(tenantContext, externalSystemRepository, featureAccessService),
  };
}

export type IntegrationDependencies = ReturnType<typeof createIntegrationDependencies>;
