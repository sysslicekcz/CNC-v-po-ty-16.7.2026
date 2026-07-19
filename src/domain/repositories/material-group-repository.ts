import { MaterialGroup } from "../entities/material-group";
import { MaterialGroupCode } from "../value-objects/material-group-code";

export interface MaterialGroupRepository {
  findById(id: string, tenantId: string): Promise<MaterialGroup | null>;
  findByCode(tenantId: string, code: MaterialGroupCode): Promise<MaterialGroup | null>;
  list(tenantId: string): Promise<MaterialGroup[]>;
  save(group: MaterialGroup): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
