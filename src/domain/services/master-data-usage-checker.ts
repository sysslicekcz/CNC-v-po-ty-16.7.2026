/**
 * Port pro "je tenhle kmenový záznam někde použitý" (Krok 5, zadání bod 23/26/41) -
 * jediné místo, které smí odpovědět na otázku "smím tenhle záznam fyzicky
 * smazat", protože odpověď vyžaduje dotaz napříč `RoutingSheet`/`Operation`/
 * `Activity`/`Machine` - přesahuje odpovědnost jednoho repository. Konkrétní
 * implementace (`DefaultMasterDataUsageChecker`) žije v infrastructure vrstvě.
 */
export interface MasterDataUsageChecker {
  isMachineInUse(machineId: string, tenantId: string): Promise<boolean>;
  isToolInUse(toolId: string, tenantId: string): Promise<boolean>;
  isOperationTypeInUse(operationTypeId: string, tenantId: string): Promise<boolean>;
  isExternalResourceInUse(externalResourceId: string, tenantId: string): Promise<boolean>;
  isCapacityGroupInUse(capacityGroupId: string, tenantId: string): Promise<boolean>;
  isMaterialGroupInUse(materialGroupId: string, tenantId: string): Promise<boolean>;
}
