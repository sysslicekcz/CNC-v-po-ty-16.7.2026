import { MachineCapability } from "../entities/machine-capability";

/** Tenant-scoped od Kroku 5 - stejný důvod jako ToolRepository. */
export interface MachineCapabilityRepository {
  findById(id: string, tenantId: string): Promise<MachineCapability | null>;
  findByMachineId(machineId: string, tenantId: string): Promise<MachineCapability[]>;
  list(tenantId: string): Promise<MachineCapability[]>;
  save(capability: MachineCapability): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
