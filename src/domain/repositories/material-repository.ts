import { Material } from "../entities/material";
import { MaterialCode } from "../value-objects/material-code";

export interface MaterialRepository {
  findById(id: string, tenantId: string): Promise<Material | null>;
  findByCode(tenantId: string, code: MaterialCode): Promise<Material | null>;
  list(tenantId: string): Promise<Material[]>;
  listByGroupId(materialGroupId: string, tenantId: string): Promise<Material[]>;
  save(material: Material): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
