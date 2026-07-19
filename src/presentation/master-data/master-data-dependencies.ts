import { LocalTenantContext } from "@/infrastructure/services/local-tenant-context";
import { IndexedDbTenantRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { LocalLicenseProvider } from "@/infrastructure/licensing/local-license-provider";
import { DevelopmentLicenseProvider } from "@/infrastructure/licensing/development-license-provider";
import { IndexedDbLicenseRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-license-repository";
import { DefaultFeatureAccessService } from "@/application/licensing/default-feature-access-service";
import { GetFeatureAccessSnapshotUseCase } from "@/application/licensing/get-feature-access-snapshot-use-case";

import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbCapacityGroupRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capacity-group-repository";
import { IndexedDbMachineCapabilityRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-repository";
import { IndexedDbCapabilityTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-capability-type-repository";
import { IndexedDbMachineCapabilityValueRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-value-repository";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbOperationTypeCapabilityRequirementRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-capability-requirement-repository";
import { IndexedDbExternalOperationResourceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-operation-resource-repository";
import { IndexedDbSupplierRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-supplier-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbToolMachineConditionRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-machine-condition-repository";
import { IndexedDbMaterialRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-repository";
import { IndexedDbMaterialGroupRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-group-repository";
import { DefaultMasterDataUsageChecker } from "@/infrastructure/persistence/indexeddb/default-master-data-usage-checker";

import { CreateMachineUseCase } from "@/application/machines/create-machine-use-case";
import { UpdateMachineUseCase } from "@/application/machines/update-machine-use-case";
import { DeactivateMachineUseCase } from "@/application/machines/deactivate-machine-use-case";
import { ReactivateMachineUseCase } from "@/application/machines/reactivate-machine-use-case";
import { DeleteMachineUseCase } from "@/application/machines/delete-machine-use-case";
import { ListMachinesUseCase } from "@/application/machines/list-machines-use-case";
import { AssignMachineToCapacityGroupUseCase } from "@/application/machines/assign-machine-to-capacity-group-use-case";
import { AssignMachineCapabilityUseCase } from "@/application/machines/assign-machine-capability-use-case";
import { RemoveMachineCapabilityUseCase } from "@/application/machines/remove-machine-capability-use-case";

import { CreateCapacityGroupUseCase } from "@/application/capacity-groups/create-capacity-group-use-case";
import { UpdateCapacityGroupUseCase } from "@/application/capacity-groups/update-capacity-group-use-case";
import { DeactivateCapacityGroupUseCase } from "@/application/capacity-groups/deactivate-capacity-group-use-case";
import { ReactivateCapacityGroupUseCase } from "@/application/capacity-groups/reactivate-capacity-group-use-case";
import { DeleteCapacityGroupUseCase } from "@/application/capacity-groups/delete-capacity-group-use-case";
import { ListCapacityGroupsUseCase } from "@/application/capacity-groups/list-capacity-groups-use-case";

import { CreateCapabilityTypeUseCase } from "@/application/capabilities/create-capability-type-use-case";
import { UpdateCapabilityTypeUseCase } from "@/application/capabilities/update-capability-type-use-case";
import { ListCapabilityTypesUseCase } from "@/application/capabilities/list-capability-types-use-case";
import { AssignMachineCapabilityValueUseCase } from "@/application/capabilities/assign-machine-capability-value-use-case";
import { RemoveMachineCapabilityValueUseCase } from "@/application/capabilities/remove-machine-capability-value-use-case";

import { CreateOperationTypeUseCase } from "@/application/operation-types/create-operation-type-use-case";
import { UpdateOperationTypeUseCase } from "@/application/operation-types/update-operation-type-use-case";
import { DeactivateOperationTypeUseCase } from "@/application/operation-types/deactivate-operation-type-use-case";
import { ReactivateOperationTypeUseCase } from "@/application/operation-types/reactivate-operation-type-use-case";
import { ListOperationTypesUseCase } from "@/application/operation-types/list-operation-types-use-case";
import { ConfigureOperationTypeCapabilitiesUseCase } from "@/application/operation-types/configure-operation-type-capabilities-use-case";
import { RemoveOperationTypeCapabilityRequirementUseCase } from "@/application/operation-types/remove-operation-type-capability-requirement-use-case";

import { CreateExternalOperationResourceUseCase } from "@/application/cooperations/create-external-operation-resource-use-case";
import { UpdateExternalOperationResourceUseCase } from "@/application/cooperations/update-external-operation-resource-use-case";
import { DeactivateExternalOperationResourceUseCase } from "@/application/cooperations/deactivate-external-operation-resource-use-case";
import { ReactivateExternalOperationResourceUseCase } from "@/application/cooperations/reactivate-external-operation-resource-use-case";
import { DeleteExternalOperationResourceUseCase } from "@/application/cooperations/delete-external-operation-resource-use-case";
import { ListExternalOperationResourcesUseCase } from "@/application/cooperations/list-external-operation-resources-use-case";

import { CreateSupplierUseCase } from "@/application/suppliers/create-supplier-use-case";
import { UpdateSupplierUseCase } from "@/application/suppliers/update-supplier-use-case";
import { DeactivateSupplierUseCase } from "@/application/suppliers/deactivate-supplier-use-case";
import { ListSuppliersUseCase } from "@/application/suppliers/list-suppliers-use-case";

import { CreateToolUseCase } from "@/application/tools/create-tool-use-case";
import { UpdateToolUseCase } from "@/application/tools/update-tool-use-case";
import { DeactivateToolUseCase } from "@/application/tools/deactivate-tool-use-case";
import { ReactivateToolUseCase } from "@/application/tools/reactivate-tool-use-case";
import { ListToolsUseCase } from "@/application/tools/list-tools-use-case";
import { CreateToolTypeUseCase } from "@/application/tools/create-tool-type-use-case";
import { UpdateToolTypeUseCase } from "@/application/tools/update-tool-type-use-case";
import { DeactivateToolTypeUseCase } from "@/application/tools/deactivate-tool-type-use-case";
import { ListToolTypesUseCase } from "@/application/tools/list-tool-types-use-case";

import { CreateToolMachineConditionUseCase } from "@/application/cutting-conditions/create-tool-machine-condition-use-case";
import { UpdateToolMachineConditionUseCase } from "@/application/cutting-conditions/update-tool-machine-condition-use-case";
import { DeactivateToolMachineConditionUseCase } from "@/application/cutting-conditions/deactivate-tool-machine-condition-use-case";
import { ListToolMachineConditionsUseCase } from "@/application/cutting-conditions/list-tool-machine-conditions-use-case";
import { ResolveCuttingConditionUseCase } from "@/application/cutting-conditions/resolve-cutting-condition-use-case";

import { CreateMaterialGroupUseCase } from "@/application/materials/create-material-group-use-case";
import { DeactivateMaterialGroupUseCase } from "@/application/materials/deactivate-material-group-use-case";
import { ListMaterialGroupsUseCase } from "@/application/materials/list-material-groups-use-case";
import { CreateMaterialUseCase } from "@/application/materials/create-material-use-case";
import { UpdateMaterialUseCase } from "@/application/materials/update-material-use-case";
import { DeactivateMaterialUseCase } from "@/application/materials/deactivate-material-use-case";
import { ListMaterialsUseCase } from "@/application/materials/list-materials-use-case";

/**
 * Jedna factory funkce pro CELOU sekci `/tpv/master-data/*` (Krok 5) - stejný
 * vzor jako `routing-sheet-editor-dependencies.ts` z Kroku 4 (žádný DI
 * kontejner v projektu, viz docs/audits/step-5-audit.md). Volá se JEDNOU přes
 * `useMemo` v každé master-data stránce.
 */
export function createMasterDataDependencies() {
  const tenantContext = new LocalTenantContext();
  const tenantRepository = new IndexedDbTenantRepository();
  const licenseRepository = new IndexedDbLicenseRepository();
  const licenseProvider = new DevelopmentLicenseProvider(new LocalLicenseProvider(tenantContext, licenseRepository));
  const featureAccessService = new DefaultFeatureAccessService(tenantContext, tenantRepository, licenseProvider);
  const usageChecker = new DefaultMasterDataUsageChecker();

  const machineRepository = new IndexedDbMachineRepository();
  const capacityGroupRepository = new IndexedDbCapacityGroupRepository();
  const machineCapabilityRepository = new IndexedDbMachineCapabilityRepository();
  const capabilityTypeRepository = new IndexedDbCapabilityTypeRepository();
  const machineCapabilityValueRepository = new IndexedDbMachineCapabilityValueRepository();
  const operationTypeRepository = new IndexedDbOperationTypeRepository();
  const operationTypeCapabilityRequirementRepository = new IndexedDbOperationTypeCapabilityRequirementRepository();
  const externalResourceRepository = new IndexedDbExternalOperationResourceRepository();
  const supplierRepository = new IndexedDbSupplierRepository();
  const toolRepository = new IndexedDbToolRepository();
  const toolTypeRepository = new IndexedDbToolTypeRepository();
  const toolMachineConditionRepository = new IndexedDbToolMachineConditionRepository();
  const materialRepository = new IndexedDbMaterialRepository();
  const materialGroupRepository = new IndexedDbMaterialGroupRepository();

  return {
    tenantContext,
    featureAccessService,
    machineRepository,
    capacityGroupRepository,
    machineCapabilityRepository,
    capabilityTypeRepository,
    operationTypeRepository,
    externalResourceRepository,
    supplierRepository,
    toolRepository,
    toolTypeRepository,
    toolMachineConditionRepository,
    materialRepository,
    materialGroupRepository,

    getFeatureAccessSnapshotUseCase: new GetFeatureAccessSnapshotUseCase(tenantContext, tenantRepository, featureAccessService),

    createMachineUseCase: new CreateMachineUseCase(tenantContext, machineRepository, featureAccessService),
    updateMachineUseCase: new UpdateMachineUseCase(tenantContext, machineRepository, featureAccessService),
    deactivateMachineUseCase: new DeactivateMachineUseCase(tenantContext, machineRepository, featureAccessService),
    reactivateMachineUseCase: new ReactivateMachineUseCase(tenantContext, machineRepository, featureAccessService),
    deleteMachineUseCase: new DeleteMachineUseCase(tenantContext, machineRepository, usageChecker, featureAccessService),
    listMachinesUseCase: new ListMachinesUseCase(tenantContext, machineRepository, featureAccessService),
    assignMachineToCapacityGroupUseCase: new AssignMachineToCapacityGroupUseCase(
      tenantContext,
      machineRepository,
      capacityGroupRepository,
      featureAccessService
    ),
    assignMachineCapabilityUseCase: new AssignMachineCapabilityUseCase(
      tenantContext,
      machineCapabilityRepository,
      machineRepository,
      operationTypeRepository,
      featureAccessService
    ),
    removeMachineCapabilityUseCase: new RemoveMachineCapabilityUseCase(tenantContext, machineCapabilityRepository, featureAccessService),

    createCapacityGroupUseCase: new CreateCapacityGroupUseCase(tenantContext, capacityGroupRepository, featureAccessService),
    updateCapacityGroupUseCase: new UpdateCapacityGroupUseCase(tenantContext, capacityGroupRepository, featureAccessService),
    deactivateCapacityGroupUseCase: new DeactivateCapacityGroupUseCase(tenantContext, capacityGroupRepository, featureAccessService),
    reactivateCapacityGroupUseCase: new ReactivateCapacityGroupUseCase(tenantContext, capacityGroupRepository, featureAccessService),
    deleteCapacityGroupUseCase: new DeleteCapacityGroupUseCase(tenantContext, capacityGroupRepository, usageChecker, featureAccessService),
    listCapacityGroupsUseCase: new ListCapacityGroupsUseCase(tenantContext, capacityGroupRepository, featureAccessService),

    createCapabilityTypeUseCase: new CreateCapabilityTypeUseCase(tenantContext, capabilityTypeRepository, featureAccessService),
    updateCapabilityTypeUseCase: new UpdateCapabilityTypeUseCase(tenantContext, capabilityTypeRepository, featureAccessService),
    listCapabilityTypesUseCase: new ListCapabilityTypesUseCase(tenantContext, capabilityTypeRepository, featureAccessService),
    assignMachineCapabilityValueUseCase: new AssignMachineCapabilityValueUseCase(
      tenantContext,
      machineCapabilityValueRepository,
      machineRepository,
      capabilityTypeRepository,
      featureAccessService
    ),
    removeMachineCapabilityValueUseCase: new RemoveMachineCapabilityValueUseCase(
      tenantContext,
      machineCapabilityValueRepository,
      featureAccessService
    ),
    machineCapabilityValueRepository,

    createOperationTypeUseCase: new CreateOperationTypeUseCase(tenantContext, operationTypeRepository, featureAccessService),
    updateOperationTypeUseCase: new UpdateOperationTypeUseCase(tenantContext, operationTypeRepository, featureAccessService),
    deactivateOperationTypeUseCase: new DeactivateOperationTypeUseCase(tenantContext, operationTypeRepository, featureAccessService),
    reactivateOperationTypeUseCase: new ReactivateOperationTypeUseCase(tenantContext, operationTypeRepository, featureAccessService),
    listOperationTypesUseCase: new ListOperationTypesUseCase(tenantContext, operationTypeRepository, featureAccessService),
    configureOperationTypeCapabilitiesUseCase: new ConfigureOperationTypeCapabilitiesUseCase(
      tenantContext,
      operationTypeCapabilityRequirementRepository,
      operationTypeRepository,
      capabilityTypeRepository,
      featureAccessService
    ),
    removeOperationTypeCapabilityRequirementUseCase: new RemoveOperationTypeCapabilityRequirementUseCase(
      tenantContext,
      operationTypeCapabilityRequirementRepository,
      featureAccessService
    ),
    operationTypeCapabilityRequirementRepository,

    createExternalOperationResourceUseCase: new CreateExternalOperationResourceUseCase(
      tenantContext,
      externalResourceRepository,
      featureAccessService
    ),
    updateExternalOperationResourceUseCase: new UpdateExternalOperationResourceUseCase(
      tenantContext,
      externalResourceRepository,
      featureAccessService
    ),
    deactivateExternalOperationResourceUseCase: new DeactivateExternalOperationResourceUseCase(
      tenantContext,
      externalResourceRepository,
      featureAccessService
    ),
    reactivateExternalOperationResourceUseCase: new ReactivateExternalOperationResourceUseCase(
      tenantContext,
      externalResourceRepository,
      featureAccessService
    ),
    deleteExternalOperationResourceUseCase: new DeleteExternalOperationResourceUseCase(
      tenantContext,
      externalResourceRepository,
      usageChecker,
      featureAccessService
    ),
    listExternalOperationResourcesUseCase: new ListExternalOperationResourcesUseCase(
      tenantContext,
      externalResourceRepository,
      featureAccessService
    ),

    createSupplierUseCase: new CreateSupplierUseCase(tenantContext, supplierRepository, featureAccessService),
    updateSupplierUseCase: new UpdateSupplierUseCase(tenantContext, supplierRepository, featureAccessService),
    deactivateSupplierUseCase: new DeactivateSupplierUseCase(tenantContext, supplierRepository, featureAccessService),
    listSuppliersUseCase: new ListSuppliersUseCase(tenantContext, supplierRepository, featureAccessService),

    createToolUseCase: new CreateToolUseCase(tenantContext, toolRepository, toolTypeRepository, featureAccessService),
    updateToolUseCase: new UpdateToolUseCase(tenantContext, toolRepository, toolTypeRepository, featureAccessService),
    deactivateToolUseCase: new DeactivateToolUseCase(tenantContext, toolRepository, featureAccessService),
    reactivateToolUseCase: new ReactivateToolUseCase(tenantContext, toolRepository, featureAccessService),
    listToolsUseCase: new ListToolsUseCase(tenantContext, toolRepository, featureAccessService),
    createToolTypeUseCase: new CreateToolTypeUseCase(tenantContext, toolTypeRepository, featureAccessService),
    updateToolTypeUseCase: new UpdateToolTypeUseCase(tenantContext, toolTypeRepository, featureAccessService),
    deactivateToolTypeUseCase: new DeactivateToolTypeUseCase(tenantContext, toolTypeRepository, featureAccessService),
    listToolTypesUseCase: new ListToolTypesUseCase(tenantContext, toolTypeRepository, featureAccessService),

    createToolMachineConditionUseCase: new CreateToolMachineConditionUseCase(
      tenantContext,
      toolMachineConditionRepository,
      toolRepository,
      machineRepository,
      featureAccessService
    ),
    updateToolMachineConditionUseCase: new UpdateToolMachineConditionUseCase(
      tenantContext,
      toolMachineConditionRepository,
      featureAccessService
    ),
    deactivateToolMachineConditionUseCase: new DeactivateToolMachineConditionUseCase(
      tenantContext,
      toolMachineConditionRepository,
      featureAccessService
    ),
    listToolMachineConditionsUseCase: new ListToolMachineConditionsUseCase(
      tenantContext,
      toolMachineConditionRepository,
      featureAccessService
    ),
    resolveCuttingConditionUseCase: new ResolveCuttingConditionUseCase(
      tenantContext,
      toolRepository,
      toolMachineConditionRepository,
      featureAccessService
    ),

    createMaterialGroupUseCase: new CreateMaterialGroupUseCase(tenantContext, materialGroupRepository, featureAccessService),
    deactivateMaterialGroupUseCase: new DeactivateMaterialGroupUseCase(tenantContext, materialGroupRepository, featureAccessService),
    listMaterialGroupsUseCase: new ListMaterialGroupsUseCase(tenantContext, materialGroupRepository, featureAccessService),
    createMaterialUseCase: new CreateMaterialUseCase(tenantContext, materialRepository, materialGroupRepository, featureAccessService),
    updateMaterialUseCase: new UpdateMaterialUseCase(tenantContext, materialRepository, materialGroupRepository, featureAccessService),
    deactivateMaterialUseCase: new DeactivateMaterialUseCase(tenantContext, materialRepository, featureAccessService),
    listMaterialsUseCase: new ListMaterialsUseCase(tenantContext, materialRepository, featureAccessService),
  };
}

export type MasterDataDependencies = ReturnType<typeof createMasterDataDependencies>;
