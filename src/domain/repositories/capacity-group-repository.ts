import { CapacityGroup } from "../entities/capacity-group";
import { CapacityGroupCode } from "../value-objects/capacity-group-code";

export interface CapacityGroupRepository {
  findById(id: string, tenantId: string): Promise<CapacityGroup | null>;
  findByCode(tenantId: string, code: CapacityGroupCode): Promise<CapacityGroup | null>;
  list(tenantId: string): Promise<CapacityGroup[]>;
  save(group: CapacityGroup): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
