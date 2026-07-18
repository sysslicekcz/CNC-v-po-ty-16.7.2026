import { Tool } from "../entities/tool";
import { ToolMachineCondition } from "../entities/tool-machine-condition";
import { Repository } from "./repository";

export interface ToolRepository extends Repository<Tool> {
  findByToolTypeId(toolTypeId: string): Promise<Tool[]>;
}

export interface ToolMachineConditionRepository extends Repository<ToolMachineCondition> {
  findByToolAndMachine(toolId: string, machineId: string): Promise<ToolMachineCondition | null>;
}
