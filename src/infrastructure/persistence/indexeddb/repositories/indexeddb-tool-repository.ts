import { ToolRepository } from "@/domain/repositories/tool-repository";
import { Tool } from "@/domain/entities/tool";
import { ToolCode } from "@/domain/value-objects/tool-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { ToolRecord } from "../records";
import { toolToRecord, toolFromRecord } from "../mappers/tool-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped od Kroku 5 - `Tool` mělo `tenantId` pole i index na store od
 *  Kroku 3.5, jen repository ho dosud nevyužívalo (viz docs/audits/step-5-audit.md,
 *  riziko migrace č. 2). */
export class IndexedDbToolRepository implements ToolRepository {
  async findById(id: string, tenantId: string): Promise<Tool | null> {
    const record = await tpvGet<ToolRecord>("tpvTools", id);
    if (!record || record.tenantId !== tenantId) return null;
    return toolFromRecord(record);
  }

  async findByCode(tenantId: string, code: ToolCode): Promise<Tool | null> {
    const records = await tpvGetAllByIndex<ToolRecord>("tpvTools", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? toolFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<Tool[]> {
    const records = await tpvGetAllByIndex<ToolRecord>("tpvTools", "tenantId", tenantId);
    return records.map(toolFromRecord);
  }

  async findByToolTypeId(toolTypeId: string, tenantId: string): Promise<Tool[]> {
    const records = await tpvGetAllByIndex<ToolRecord>("tpvTools", "toolTypeId", toolTypeId);
    return records.filter((r) => r.tenantId === tenantId).map(toolFromRecord);
  }

  async save(tool: Tool): Promise<void> {
    const existing = await tpvGet<ToolRecord>("tpvTools", tool.id);
    try {
      await tpvPut(
        "tpvTools",
        toolToRecord(tool, {
          legacySource: existing?.legacySource,
          legacyId: existing?.legacyId,
          migrationRunId: existing?.migrationRunId,
        })
      );
    } catch (error) {
      if (isConstraintError(error) && tool.code) {
        throw new MasterDataCodeAlreadyExistsError("Nástroj", tool.tenantId, tool.code.toString());
      }
      throw error;
    }
  }

  async saveWithLegacyStamp(tool: Tool, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvTools", toolToRecord(tool, stamp));
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ToolRecord>("tpvTools", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvTools", id);
  }
}
