import { ToolType } from "../entities/tool-type";

/** Tenant-scoped od Kroku 5 - stejný důvod jako OperationTypeRepository. */
export interface ToolTypeRepository {
  findById(id: string, tenantId: string): Promise<ToolType | null>;
  findByCode(tenantId: string, kod: string): Promise<ToolType | null>;
  list(tenantId: string): Promise<ToolType[]>;
  save(toolType: ToolType): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
