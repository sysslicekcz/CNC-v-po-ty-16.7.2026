import { MachineCapability } from "@/domain/entities/machine-capability";
import { MachineCapabilityRecord } from "../records";
import { LegacyStamp } from "./common";

export function machineCapabilityToRecord(capability: MachineCapability, legacy: LegacyStamp = {}): MachineCapabilityRecord {
  return {
    id: capability.id,
    machineId: capability.machineId,
    operationTypeId: capability.operationTypeId,
    enabled: capability.enabled,
    priority: capability.priority,
    limitations: capability.limitations,
    ...legacy,
  };
}

export function machineCapabilityFromRecord(record: MachineCapabilityRecord): MachineCapability {
  return MachineCapability.create({
    id: record.id,
    machineId: record.machineId,
    operationTypeId: record.operationTypeId,
    enabled: record.enabled,
    priority: record.priority,
    limitations: record.limitations,
  });
}
