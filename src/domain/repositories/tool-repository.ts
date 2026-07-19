import { Tool } from "../entities/tool";
import { ToolCode } from "../value-objects/tool-code";

/** Tenant-scoped od Kroku 5 - `Tool` mělo `tenantId` pole už z Kroku 3.5, ale
 *  repository ho dosud nevynucovalo (latentní mezera v izolaci, viz
 *  docs/audits/step-5-audit.md, riziko migrace č. 2). */
export interface ToolRepository {
  findById(id: string, tenantId: string): Promise<Tool | null>;
  findByCode(tenantId: string, code: ToolCode): Promise<Tool | null>;
  list(tenantId: string): Promise<Tool[]>;
  findByToolTypeId(toolTypeId: string, tenantId: string): Promise<Tool[]>;
  save(tool: Tool): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
