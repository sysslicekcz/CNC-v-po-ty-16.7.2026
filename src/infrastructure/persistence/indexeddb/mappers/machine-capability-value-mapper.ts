import { MachineCapabilityValue } from "@/domain/entities/machine-capability-value";
import { MachineCapabilityValueRecord } from "../records";

export function machineCapabilityValueToRecord(value: MachineCapabilityValue): MachineCapabilityValueRecord {
  return {
    id: value.id,
    tenantId: value.tenantId,
    machineId: value.machineId,
    capabilityTypeId: value.capabilityTypeId,
    value: value.value,
  };
}

export function machineCapabilityValueFromRecord(record: MachineCapabilityValueRecord): MachineCapabilityValue {
  return MachineCapabilityValue.restore({
    id: record.id,
    tenantId: record.tenantId,
    machineId: record.machineId,
    capabilityTypeId: record.capabilityTypeId,
    value: record.value,
  });
}
