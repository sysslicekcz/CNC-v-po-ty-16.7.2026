import { MaterialRepository } from "@/domain/repositories/material-repository";
import { Material } from "@/domain/entities/material";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { MaterialRecord } from "../records";
import { materialToRecord, materialFromRecord } from "../mappers/material-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export class IndexedDbMaterialRepository implements MaterialRepository {
  async findById(id: string, tenantId: string): Promise<Material | null> {
    const record = await tpvGet<MaterialRecord>("tpvMaterials", id);
    if (!record || record.tenantId !== tenantId) return null;
    return materialFromRecord(record);
  }

  async findByCode(tenantId: string, code: MaterialCode): Promise<Material | null> {
    const records = await tpvGetAllByIndex<MaterialRecord>("tpvMaterials", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? materialFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<Material[]> {
    const records = await tpvGetAllByIndex<MaterialRecord>("tpvMaterials", "tenantId", tenantId);
    return records.map(materialFromRecord);
  }

  async listByGroupId(materialGroupId: string, tenantId: string): Promise<Material[]> {
    const records = await tpvGetAllByIndex<MaterialRecord>("tpvMaterials", "materialGroupId", materialGroupId);
    return records.filter((r) => r.tenantId === tenantId).map(materialFromRecord);
  }

  async save(material: Material): Promise<void> {
    try {
      await tpvPut("tpvMaterials", materialToRecord(material));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MasterDataCodeAlreadyExistsError("Materiál", material.tenantId, material.code.toString());
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<MaterialRecord>("tpvMaterials", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvMaterials", id);
  }
}
