import { MachineCapability } from "../entities/machine-capability";
import { Repository } from "./repository";

export interface MachineCapabilityRepository extends Repository<MachineCapability> {
  findByMachineId(machineId: string): Promise<MachineCapability[]>;
}
