import { MasterDataUsageChecker } from "@/domain/services/master-data-usage-checker";
import { tpvGetAllByIndex, tpvGetAll } from "./tpv-db";
import { OperationRecord, ActivityRecord, MachineRecord, MaterialRecord } from "./records";

/**
 * `Operation`/`Activity` NEJSOU tenant-scoped přímo (izolace jde přes
 * `RoutingSheet` root, viz Krok 4) - kontroly použití stroje/nástroje/typu
 * operace/kooperace jsou proto záměrně KONZERVATIVNÍ globální scany, ne
 * tenant-filtrované. To dělá mazání JEN opatrnější, nikdy míň bezpečné (v
 * nejhorším případě odmítne smazat záznam kvůli použití v jiném tenantovi,
 * což appka s jediným výchozím tenantem dnes stejně nerozliší). `Machine`/
 * `Material` naopak `tenantId` mají, tam se filtruje přesně.
 *
 * `Operation.externalResourceId`/`Activity.toolId` nemají vlastní IndexedDB
 * index (přidání by byl další DB verze jen kvůli mazacímu dialogu) - appka je
 * klientská/jednouživatelská a počet operací/činností je řádově desítky až
 * stovky, plný scan (`tpvGetAll`) je proto přijatelný kompromis (Krok 5,
 * zadání bod 41).
 */
export class DefaultMasterDataUsageChecker implements MasterDataUsageChecker {
  async isMachineInUse(machineId: string): Promise<boolean> {
    const operations = await tpvGetAllByIndex<OperationRecord>("tpvOperations", "machineId", machineId);
    return operations.length > 0;
  }

  async isToolInUse(toolId: string): Promise<boolean> {
    const activities = await tpvGetAll<ActivityRecord>("tpvActivities");
    return activities.some((a) => a.toolId === toolId);
  }

  async isOperationTypeInUse(operationTypeId: string): Promise<boolean> {
    const activities = await tpvGetAllByIndex<ActivityRecord>("tpvActivities", "operationTypeId", operationTypeId);
    return activities.length > 0;
  }

  async isExternalResourceInUse(externalResourceId: string): Promise<boolean> {
    const operations = await tpvGetAll<OperationRecord>("tpvOperations");
    return operations.some((o) => o.externalResourceId === externalResourceId);
  }

  async isCapacityGroupInUse(capacityGroupId: string, tenantId: string): Promise<boolean> {
    const machines = await tpvGetAllByIndex<MachineRecord>("tpvMachines", "capacityGroupId", capacityGroupId);
    return machines.some((m) => m.tenantId === tenantId);
  }

  async isMaterialGroupInUse(materialGroupId: string, tenantId: string): Promise<boolean> {
    const materials = await tpvGetAllByIndex<MaterialRecord>("tpvMaterials", "materialGroupId", materialGroupId);
    return materials.some((m) => m.tenantId === tenantId);
  }
}
