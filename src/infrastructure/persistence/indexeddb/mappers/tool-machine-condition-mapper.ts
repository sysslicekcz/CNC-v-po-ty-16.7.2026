import { ToolMachineCondition } from "@/domain/entities/tool-machine-condition";
import { ToolMachineConditionRecord } from "../records";
import {
  LegacyStamp,
  cuttingParametersToRecord,
  cuttingParametersFromRecord,
  parseEntityStav,
  parseMachiningMode,
  parseCuttingConditionSource,
} from "./common";
import { CuttingParameters } from "@/domain/value-objects/cutting-parameters";

export function toolMachineConditionToRecord(
  condition: ToolMachineCondition,
  legacy: LegacyStamp = {}
): ToolMachineConditionRecord {
  return {
    id: condition.id,
    tenantId: condition.tenantId,
    toolId: condition.toolId,
    machineId: condition.machineId,
    parameters: cuttingParametersToRecord(condition.parameters) ?? {},
    stav: condition.stav,
    operationTypeId: condition.operationTypeId,
    materialId: condition.materialId,
    machiningMode: condition.machiningMode,
    priority: condition.priority,
    source: condition.source,
    note: condition.note,
    ...legacy,
  };
}

export function toolMachineConditionFromRecord(record: ToolMachineConditionRecord): ToolMachineCondition {
  return ToolMachineCondition.restore({
    id: record.id,
    tenantId: record.tenantId,
    toolId: record.toolId,
    machineId: record.machineId,
    parameters: cuttingParametersFromRecord(record.parameters) ?? CuttingParameters.of({}),
    stav: parseEntityStav(record.stav, "ToolMachineCondition"),
    operationTypeId: record.operationTypeId,
    materialId: record.materialId,
    machiningMode: parseMachiningMode(record.machiningMode),
    priority: record.priority,
    source: parseCuttingConditionSource(record.source),
    note: record.note,
  });
}
