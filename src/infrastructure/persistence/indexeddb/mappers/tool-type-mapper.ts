import { ToolType, ToolParameterDefinition } from "@/domain/entities/tool-type";
import { ToolTypeRecord, ToolParameterDefinitionRecord } from "../records";
import { parseEntityStav, parseToolCategory, parseToolParameterValueType } from "./common";

function paramDefToRecord(def: ToolParameterDefinition): ToolParameterDefinitionRecord {
  return {
    key: def.key,
    name: def.name,
    valueType: def.valueType,
    unit: def.unit,
    required: def.required,
    allowedValues: def.allowedValues,
  };
}

function paramDefFromRecord(record: ToolParameterDefinitionRecord): ToolParameterDefinition {
  return {
    key: record.key,
    name: record.name,
    valueType: parseToolParameterValueType(record.valueType),
    unit: record.unit,
    required: record.required,
    allowedValues: record.allowedValues,
  };
}

export function toolTypeToRecord(toolType: ToolType): ToolTypeRecord {
  return {
    id: toolType.id,
    tenantId: toolType.tenantId,
    kod: toolType.kod,
    nazev: toolType.nazev,
    category: toolType.category,
    parameterDefinitions: toolType.parameterDefinitions.map(paramDefToRecord),
    stav: toolType.stav,
    popis: toolType.popis,
  };
}

export function toolTypeFromRecord(record: ToolTypeRecord): ToolType {
  return ToolType.restore({
    id: record.id,
    tenantId: record.tenantId,
    kod: record.kod,
    nazev: record.nazev,
    category: parseToolCategory(record.category),
    parameterDefinitions: record.parameterDefinitions.map(paramDefFromRecord),
    stav: parseEntityStav(record.stav, "ToolType"),
    popis: record.popis,
  });
}
