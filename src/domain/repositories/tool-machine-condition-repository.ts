import { ToolMachineCondition } from "../entities/tool-machine-condition";

/** Tenant-scoped od Kroku 5 - stejný důvod jako ToolRepository. */
export interface ToolMachineConditionRepository {
  findById(id: string, tenantId: string): Promise<ToolMachineCondition | null>;
  /** Vrací VŠECHNY profily pro danou dvojici (tool, machine) - může jich být víc
   *  (různý operationTypeId/materialId/machiningMode/priority). Výběr toho
   *  nejvhodnějšího dělá services/cutting-condition-resolver.ts, ne repozitář. */
  findByToolAndMachine(toolId: string, machineId: string, tenantId: string): Promise<ToolMachineCondition[]>;
  findByToolId(toolId: string, tenantId: string): Promise<ToolMachineCondition[]>;
  list(tenantId: string): Promise<ToolMachineCondition[]>;
  save(condition: ToolMachineCondition): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
