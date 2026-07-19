import { ToolTypeRepository } from "@/domain/repositories/tool-type-repository";
import { ToolType } from "@/domain/entities/tool-type";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { ToolTypeRecord } from "../records";
import { toolTypeToRecord, toolTypeFromRecord } from "../mappers/tool-type-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped od Kroku 5 - viz docs/audits/step-5-audit.md, riziko migrace č. 1. */
export class IndexedDbToolTypeRepository implements ToolTypeRepository {
  async findById(id: string, tenantId: string): Promise<ToolType | null> {
    const record = await tpvGet<ToolTypeRecord>("tpvToolTypes", id);
    if (!record || record.tenantId !== tenantId) return null;
    return toolTypeFromRecord(record);
  }

  async findByCode(tenantId: string, kod: string): Promise<ToolType | null> {
    const records = await tpvGetAllByIndex<ToolTypeRecord>("tpvToolTypes", "tenantId", tenantId);
    const match = records.find((r) => r.kod === kod);
    return match ? toolTypeFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<ToolType[]> {
    const records = await tpvGetAllByIndex<ToolTypeRecord>("tpvToolTypes", "tenantId", tenantId);
    return records.map(toolTypeFromRecord);
  }

  async save(toolType: ToolType): Promise<void> {
    try {
      await tpvPut("tpvToolTypes", toolTypeToRecord(toolType));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MasterDataCodeAlreadyExistsError("Typ nástroje", toolType.tenantId, toolType.kod);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ToolTypeRecord>("tpvToolTypes", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvToolTypes", id);
  }
}
