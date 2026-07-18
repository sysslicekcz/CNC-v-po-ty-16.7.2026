import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { ToolMachineConditionRecord } from "../records";
import { LegacyStamp, cuttingParametersToRecord, cuttingParametersFromRecord, parseEntityStav, parseMachiningMode } from "./common";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";

export function toolMachineConditionToRecord(
  condition: ToolMachineCondition,
  legacy: LegacyStamp = {}
): ToolMachineConditionRecord {
  return {
    id: condition.id,
    toolId: condition.toolId,
    machineId: condition.machineId,
    parameters: cuttingParametersToRecord(condition.parameters) ?? {},
    stav: condition.stav,
    operationTypeId: condition.operationTypeId,
    materialId: condition.materialId,
    machiningMode: condition.machiningMode,
    priority: condition.priority,
    ...legacy,
  };
}

export function toolMachineConditionFromRecord(record: ToolMachineConditionRecord): ToolMachineCondition {
  return ToolMachineCondition.create({
    id: record.id,
    toolId: record.toolId,
    machineId: record.machineId,
    parameters: cuttingParametersFromRecord(record.parameters) ?? CuttingParameters.of({}),
    stav: parseEntityStav(record.stav, "ToolMachineCondition"),
    operationTypeId: record.operationTypeId,
    materialId: record.materialId,
    machiningMode: parseMachiningMode(record.machiningMode),
    priority: record.priority,
  });
}
