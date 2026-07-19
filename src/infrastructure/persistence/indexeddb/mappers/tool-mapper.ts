import { Tool } from "@/domain/entities/tool";
import { ToolCode } from "@/domain/value-objects/tool-code";
import { ToolRecord } from "../records";
import { LegacyStamp, cuttingParametersToRecord, cuttingParametersFromRecord, parseEntityStav } from "./common";

export function toolToRecord(tool: Tool, legacy: LegacyStamp = {}): ToolRecord {
  return {
    id: tool.id,
    tenantId: tool.tenantId,
    code: tool.code?.toString(),
    nazev: tool.nazev,
    toolTypeId: tool.toolTypeId,
    manufacturer: tool.manufacturer,
    designation: tool.designation,
    parameters: tool.parameters ? { ...tool.parameters } : undefined,
    stav: tool.stav,
    radius: tool.radius,
    defaultCuttingParameters: cuttingParametersToRecord(tool.defaultCuttingParameters),
    poznamka: tool.poznamka,
    ...legacy,
  };
}

export function toolFromRecord(record: ToolRecord): Tool {
  return Tool.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: record.code ? ToolCode.create(record.code) : undefined,
    nazev: record.nazev,
    toolTypeId: record.toolTypeId,
    manufacturer: record.manufacturer,
    designation: record.designation,
    parameters: record.parameters,
    stav: parseEntityStav(record.stav, "Tool"),
    radius: record.radius,
    defaultCuttingParameters: cuttingParametersFromRecord(record.defaultCuttingParameters),
    poznamka: record.poznamka,
  });
}
