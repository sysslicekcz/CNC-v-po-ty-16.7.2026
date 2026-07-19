import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { MaterialGroupRecord } from "../records";
import { materialGroupToRecord, materialGroupFromRecord } from "../mappers/material-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export class IndexedDbMaterialGroupRepository implements MaterialGroupRepository {
  async findById(id: string, tenantId: string): Promise<MaterialGroup | null> {
    const record = await tpvGet<MaterialGroupRecord>("tpvMaterialGroups", id);
    if (!record || record.tenantId !== tenantId) return null;
    return materialGroupFromRecord(record);
  }

  async findByCode(tenantId: string, code: MaterialGroupCode): Promise<MaterialGroup | null> {
    const records = await tpvGetAllByIndex<MaterialGroupRecord>("tpvMaterialGroups", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? materialGroupFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<MaterialGroup[]> {
    const records = await tpvGetAllByIndex<MaterialGroupRecord>("tpvMaterialGroups", "tenantId", tenantId);
    return records.map(materialGroupFromRecord);
  }

  async save(group: MaterialGroup): Promise<void> {
    try {
      await tpvPut("tpvMaterialGroups", materialGroupToRecord(group));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MasterDataCodeAlreadyExistsError("Materiálová skupina", group.tenantId, group.code.toString());
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<MaterialGroupRecord>("tpvMaterialGroups", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvMaterialGroups", id);
  }
}
