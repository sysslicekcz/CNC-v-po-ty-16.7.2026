import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { CapabilityType } from "@/domain/entities/capability-type";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { CapabilityTypeRecord } from "../records";
import { capabilityTypeToRecord, capabilityTypeFromRecord } from "../mappers/capability-type-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export class IndexedDbCapabilityTypeRepository implements CapabilityTypeRepository {
  async findById(id: string, tenantId: string): Promise<CapabilityType | null> {
    const record = await tpvGet<CapabilityTypeRecord>("tpvCapabilityTypes", id);
    if (!record || record.tenantId !== tenantId) return null;
    return capabilityTypeFromRecord(record);
  }

  async findByCode(tenantId: string, code: string): Promise<CapabilityType | null> {
    const records = await tpvGetAllByIndex<CapabilityTypeRecord>("tpvCapabilityTypes", "tenantId", tenantId);
    const match = records.find((r) => r.code === code);
    return match ? capabilityTypeFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<CapabilityType[]> {
    const records = await tpvGetAllByIndex<CapabilityTypeRecord>("tpvCapabilityTypes", "tenantId", tenantId);
    return records.map(capabilityTypeFromRecord);
  }

  async save(capabilityType: CapabilityType): Promise<void> {
    try {
      await tpvPut("tpvCapabilityTypes", capabilityTypeToRecord(capabilityType));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MasterDataCodeAlreadyExistsError("Typ capability", capabilityType.tenantId, capabilityType.code);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<CapabilityTypeRecord>("tpvCapabilityTypes", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvCapabilityTypes", id);
  }
}
