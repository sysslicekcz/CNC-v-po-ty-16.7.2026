import { CapabilityType } from "../entities/capability-type";

export interface CapabilityTypeRepository {
  findById(id: string, tenantId: string): Promise<CapabilityType | null>;
  findByCode(tenantId: string, code: string): Promise<CapabilityType | null>;
  list(tenantId: string): Promise<CapabilityType[]>;
  save(capabilityType: CapabilityType): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
