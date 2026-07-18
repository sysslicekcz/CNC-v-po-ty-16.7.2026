/**
 * Centrální katalog funkčních kódů appky (Krok 3.5, bod 20) - jediný zdroj
 * pravdy pro "co appka umí", použitelný v Application vrstvě, UI i v datech
 * licence. Žádné rovnocenné varianty stejné funkce (`heliosEnabled`,
 * `canUseHelios`, ...) - jen tenhle seznam.
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
  | "planning.view"
  | "planning.edit"
  | "planning.auto_schedule"
  | "integration.helios.import"
  | "integration.helios.export"
  | "integration.helios.sync"
  | "integration.helios.configuration";

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
  PlanningView: "planning.view",
  PlanningEdit: "planning.edit",
  PlanningAutoSchedule: "planning.auto_schedule",
  IntegrationHeliosImport: "integration.helios.import",
  IntegrationHeliosExport: "integration.helios.export",
  IntegrationHeliosSync: "integration.helios.sync",
  IntegrationHeliosConfiguration: "integration.helios.configuration",
} as const satisfies Record<string, FeatureCode>;
