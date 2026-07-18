import { ToolMachineCondition } from "../entities/tool-machine-condition";
import { Repository } from "./repository";

export interface ToolMachineConditionRepository extends Repository<ToolMachineCondition> {
  /** Vrací VŠECHNY profily pro danou dvojici (tool, machine) - může jich být víc
   *  (různý operationTypeId/materialId/machiningMode/priority). Výběr toho
   *  nejvhodnějšího dělá services/cutting-condition-resolver.ts, ne repozitář. */
  findByToolAndMachine(toolId: string, machineId: string): Promise<ToolMachineCondition[]>;
}
