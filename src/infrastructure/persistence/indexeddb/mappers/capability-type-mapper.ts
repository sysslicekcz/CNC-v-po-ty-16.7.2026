import { CapabilityType } from "@/domain/entities/capability-type";
import { CapabilityTypeRecord } from "../records";
import { parseCapabilityValueType, parseMasterDataStatus } from "./common";

export function capabilityTypeToRecord(capabilityType: CapabilityType): CapabilityTypeRecord {
  return {
    id: capabilityType.id,
    tenantId: capabilityType.tenantId,
    code: capabilityType.code,
    name: capabilityType.name,
    valueType: capabilityType.valueType,
    unit: capabilityType.unit,
    allowedValues: capabilityType.allowedValues ? [...capabilityType.allowedValues] : undefined,
    status: capabilityType.status,
  };
}

export function capabilityTypeFromRecord(record: CapabilityTypeRecord): CapabilityType {
  return CapabilityType.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: record.code,
    name: record.name,
    valueType: parseCapabilityValueType(record.valueType),
    unit: record.unit,
    allowedValues: record.allowedValues,
    status: parseMasterDataStatus(record.status),
  });
}
