/**
 * Centrální katalog funkčních kódů appky (Krok 3.5, bod 20) - jediný zdroj
 * pravdy pro "co appka umí", použitelný v Application vrstvě, UI i v datech
 * licence. Žádné rovnocenné varianty stejné funkce (`heliosEnabled`,
 * `canUseHelios`, ...) - jen tenhle seznam.
 *
 * Integrační funkce jsou ERP-neutrální (`integration.erp.*`/`integration.file.*`) -
 * viz docs/adr/erp-agnostic-integration-layer.md. Konkrétní konektor (Helios,
 * SAP, K2, vlastní REST API, ...) má svou dostupnost řízenou samostatným
 * dynamickým `ConnectorFeatureCode` (`connector.helios`, `connector.sap`, ...),
 * NE položkou v tomhle uzavřeném katalogu - přidání nového konektoru tak nikdy
 * nevyžaduje změnu `FeatureCode`.
 */
export type FeatureCode =
  | "routing.view"
  | "routing.edit"
  | "routing.release"
  | "calculations.basic"
  | "calculations.advanced"
  | "machines.view"
  | "machines.manage"
  | "machines.capacity_groups"
  | "tools.view"
  | "tools.manage"
  | "cooperations.view"
  | "cooperations.manage"
  | "operation_types.view"
  | "operation_types.manage"
  | "cutting_conditions.view"
  | "cutting_conditions.manage"
  | "materials.view"
  | "materials.manage"
  | "planning.view"
  | "planning.edit"
  | "planning.auto_schedule"
  | "integration.erp.view"
  | "integration.erp.configure"
  | "integration.erp.import"
  | "integration.erp.export"
  | "integration.erp.sync"
  | "integration.erp.multiple_systems"
  | "integration.file.import"
  | "integration.file.export"
  // AP-MCE-001 Fáze B §12 - JEMNĚJŠÍ oprávnění pro Manufacturing Calculation
  // Engine profily (Material/Machine/ToolProfile, CuttingCondition), odlišné
  // od hrubšího Fáze A "calculations.basic"/"calculations.advanced" (to zůstává
  // pro budoucí Presentation-level gating, tenhle čtveřice řídí konkrétně
  // správu profilů a jejich použití ve výpočtu - viz FeatureAccessService.require
  // volání v `application/calculation-engine/use-cases/*`).
  | "calculation.read"
  | "calculation.create"
  | "calculation.edit"
  | "calculation.admin"
  // AP-MCE-001 Fáze C §17 - `calculation.turning` řídí konkrétně spuštění
  // `TurningCalculationStrategy` (bez něj se strategie nesmí spustit, kontrola
  // NENÍ jen v UI - viz `CalculateTurningOperationUseCase`); `calculation.
  // override`/`calculation.approve` jsou jemnější oprávnění nad rámec Fáze B
  // čtveřice (ruční přepis vypočteného času / schválení výsledku).
  | "calculation.override"
  | "calculation.approve"
  | "calculation.turning";

/** Dynamický doplněk `FeatureCode` pro dostupnost KONKRÉTNÍHO konektoru
 *  (`connector.helios`, `connector.sap`, `connector.custom-rest`, ...) - licence
 *  tak může povolit/zakázat jednotlivé konektory nezávisle na obecných
 *  `integration.erp.*` funkcích, aniž by uzavřený katalog `FeatureCode` musel
 *  znát předem všechny možné konektory (viz `ErpConnectorDescriptor.requiredFeatureCode`). */
export type ConnectorFeatureCode = `connector.${string}`;

/** Cokoliv, co může být `LicensedFeature.code` - buď stabilní `FeatureCode` z
 *  katalogu, nebo dynamický `ConnectorFeatureCode` konkrétního konektoru. */
export type LicenseFeatureCode = FeatureCode | ConnectorFeatureCode;

/** Stejné hodnoty jako `FeatureCode`, jen jako objekt pro pohodlnější
 *  autocomplete na volajících místech (`FeatureCodes.MachinesManage` místo
 *  literálu `"machines.manage"`). Typ `FeatureCode` zůstává zdrojem pravdy. */
export const FeatureCodes = {
  RoutingView: "routing.view",
  RoutingEdit: "routing.edit",
  RoutingRelease: "routing.release",
  CalculationsBasic: "calculations.basic",
  CalculationsAdvanced: "calculations.advanced",
  MachinesView: "machines.view",
  MachinesManage: "machines.manage",
  MachinesCapacityGroups: "machines.capacity_groups",
  ToolsView: "tools.view",
  ToolsManage: "tools.manage",
  CooperationsView: "cooperations.view",
  CooperationsManage: "cooperations.manage",
  OperationTypesView: "operation_types.view",
  OperationTypesManage: "operation_types.manage",
  CuttingConditionsView: "cutting_conditions.view",
  CuttingConditionsManage: "cutting_conditions.manage",
  MaterialsView: "materials.view",
  MaterialsManage: "materials.manage",
  PlanningView: "planning.view",
  PlanningEdit: "planning.edit",
  PlanningAutoSchedule: "planning.auto_schedule",
  IntegrationErpView: "integration.erp.view",
  IntegrationErpConfigure: "integration.erp.configure",
  IntegrationErpImport: "integration.erp.import",
  IntegrationErpExport: "integration.erp.export",
  IntegrationErpSync: "integration.erp.sync",
  IntegrationErpMultipleSystems: "integration.erp.multiple_systems",
  IntegrationFileImport: "integration.file.import",
  IntegrationFileExport: "integration.file.export",
  CalculationRead: "calculation.read",
  CalculationCreate: "calculation.create",
  CalculationEdit: "calculation.edit",
  CalculationAdmin: "calculation.admin",
  CalculationOverride: "calculation.override",
  CalculationApprove: "calculation.approve",
  CalculationTurning: "calculation.turning",
} as const satisfies Record<string, FeatureCode>;

/** Sestaví `ConnectorFeatureCode` pro daný `connectorType` (`"helios"` ->
 *  `"connector.helios"`) - jediné místo, které tenhle tvar skládá. */
export function connectorFeatureCode(connectorType: string): ConnectorFeatureCode {
  return `connector.${connectorType}`;
}
