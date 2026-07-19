import { MachineCapabilityValue } from "../entities/machine-capability-value";

export interface MachineCapabilityValueRepository {
  findById(id: string, tenantId: string): Promise<MachineCapabilityValue | null>;
  findByMachineId(machineId: string, tenantId: string): Promise<MachineCapabilityValue[]>;
  findByCapabilityTypeId(capabilityTypeId: string, tenantId: string): Promise<MachineCapabilityValue[]>;
  save(value: MachineCapabilityValue): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
