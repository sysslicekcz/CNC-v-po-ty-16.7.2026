import { LocalTenantContext } from "@/infrastructure/services/local-tenant-context";
import { IndexedDbTenantRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { LocalLicenseProvider } from "@/infrastructure/licensing/local-license-provider";
import { DevelopmentLicenseProvider } from "@/infrastructure/licensing/development-license-provider";
import { IndexedDbLicenseRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-license-repository";
import { DefaultFeatureAccessService } from "@/application/licensing/default-feature-access-service";
import { GetFeatureAccessSnapshotUseCase } from "@/application/licensing/get-feature-access-snapshot-use-case";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { IndexedDbReleasedRoutingSheetSnapshotRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-released-routing-sheet-snapshot-repository";
import { IndexedDbPartRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-part-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbExternalOperationResourceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-operation-resource-repository";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { LegacyCalculationEngine } from "@/infrastructure/calculation/legacy-calculation-engine";
import { CreateRoutingSheetUseCase } from "@/application/routing-sheets/create-routing-sheet-use-case";
import { GetRoutingSheetEditorUseCase } from "@/application/routing-sheets/get-routing-sheet-editor-use-case";
import { SaveRoutingSheetDraftUseCase } from "@/application/routing-sheets/save-routing-sheet-draft-use-case";
import { ReleaseRoutingSheetUseCase } from "@/application/routing-sheets/release-routing-sheet-use-case";
import { CreateRoutingSheetRevisionUseCase } from "@/application/routing-sheets/create-routing-sheet-revision-use-case";
import { DuplicateRoutingSheetUseCase } from "@/application/routing-sheets/duplicate-routing-sheet-use-case";
import { ListRoutingSheetsUseCase } from "@/application/routing-sheets/list-routing-sheets-use-case";
import { GetReleasedRoutingSheetUseCase } from "@/application/routing-sheets/get-released-routing-sheet-use-case";
import { CalculateOperationUseCase } from "@/application/routing-sheets/calculate-operation-use-case";
import { ValidateRoutingSheetUseCase } from "@/application/routing-sheets/validate-routing-sheet-use-case";

/**
 * Sestaví všechny use casy potřebné editorem NAD STEJNÝMI konkrétními
 * repozitáři (žádný DI kontejner v projektu, viz docs/audits/step-4-audit.md) -
 * volá se jednou přes `useMemo` v `useRoutingSheetEditor`, ne opakovaně při
 * každém renderu. `DevelopmentLicenseProvider` obaluje `LocalLicenseProvider`
 * a mimo vývojové prostředí se chová jako průhledný passthrough (Krok 3.5) -
 * bezpečné použít i tady.
 */
export function createRoutingSheetEditorDependencies() {
  const tenantContext = new LocalTenantContext();
  const tenantRepository = new IndexedDbTenantRepository();
  const licenseRepository = new IndexedDbLicenseRepository();
  const licenseProvider = new DevelopmentLicenseProvider(new LocalLicenseProvider(tenantContext, licenseRepository));
  const featureAccessService = new DefaultFeatureAccessService(tenantContext, tenantRepository, licenseProvider);

  const routingSheetRepository = new IndexedDbRoutingSheetRepository();
  const releasedSnapshotRepository = new IndexedDbReleasedRoutingSheetSnapshotRepository();
  const partRepository = new IndexedDbPartRepository();
  const machineRepository = new IndexedDbMachineRepository();
  const externalResourceRepository = new IndexedDbExternalOperationResourceRepository();
  const operationTypeRepository = new IndexedDbOperationTypeRepository();
  const toolRepository = new IndexedDbToolRepository();
  const calculationEngine = new LegacyCalculationEngine();
  const validateRoutingSheetUseCase = new ValidateRoutingSheetUseCase();

  return {
    tenantContext,
    featureAccessService,
    routingSheetRepository,
    partRepository,
    machineRepository,
    externalResourceRepository,
    operationTypeRepository,
    toolRepository,
    getFeatureAccessSnapshotUseCase: new GetFeatureAccessSnapshotUseCase(tenantContext, tenantRepository, featureAccessService),
    createRoutingSheetUseCase: new CreateRoutingSheetUseCase(tenantContext, routingSheetRepository, partRepository, featureAccessService),
    getRoutingSheetEditorUseCase: new GetRoutingSheetEditorUseCase(
      tenantContext,
      routingSheetRepository,
      partRepository,
      machineRepository,
      externalResourceRepository,
      operationTypeRepository,
      toolRepository,
      featureAccessService,
      validateRoutingSheetUseCase
    ),
    saveRoutingSheetDraftUseCase: new SaveRoutingSheetDraftUseCase(tenantContext, routingSheetRepository, featureAccessService),
    releaseRoutingSheetUseCase: new ReleaseRoutingSheetUseCase(
      tenantContext,
      routingSheetRepository,
      releasedSnapshotRepository,
      partRepository,
      machineRepository,
      externalResourceRepository,
      operationTypeRepository,
      toolRepository,
      featureAccessService,
      validateRoutingSheetUseCase
    ),
    createRoutingSheetRevisionUseCase: new CreateRoutingSheetRevisionUseCase(tenantContext, routingSheetRepository, featureAccessService),
    duplicateRoutingSheetUseCase: new DuplicateRoutingSheetUseCase(tenantContext, routingSheetRepository, featureAccessService),
    listRoutingSheetsUseCase: new ListRoutingSheetsUseCase(tenantContext, routingSheetRepository, partRepository, featureAccessService),
    getReleasedRoutingSheetUseCase: new GetReleasedRoutingSheetUseCase(tenantContext, releasedSnapshotRepository, featureAccessService),
    calculateOperationUseCase: new CalculateOperationUseCase(
      tenantContext,
      machineRepository,
      toolRepository,
      operationTypeRepository,
      calculationEngine,
      featureAccessService
    ),
    validateRoutingSheetUseCase,
  };
}

export type RoutingSheetEditorDependencies = ReturnType<typeof createRoutingSheetEditorDependencies>;
