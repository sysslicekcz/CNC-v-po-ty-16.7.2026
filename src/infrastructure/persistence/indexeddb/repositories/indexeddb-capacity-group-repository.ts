import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { CapacityGroup } from "@/domain/entities/capacity-group";
import { CapacityGroupCode } from "@/domain/value-objects/capacity-group-code";
import { CapacityGroupCodeAlreadyExistsError } from "@/domain/errors/capacity-group-code-already-exists-error";
import { CapacityGroupRecord } from "../records";
import { capacityGroupToRecord, capacityGroupFromRecord } from "../mappers/capacity-group-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped stejným způsobem jako IndexedDbMachineRepository (docs/adr/0019) -
 *  `findById`/`delete` vždy ověří shodu tenantId, unikátnost `[tenantId, code]`
 *  hlídá primárně use case (findByCode před save) a jako poslední pojistka
 *  unikátní index `tenantId_code` na `tpvCapacityGroups`. */
export class IndexedDbCapacityGroupRepository implements CapacityGroupRepository {
  async findById(id: string, tenantId: string): Promise<CapacityGroup | null> {
    const record = await tpvGet<CapacityGroupRecord>("tpvCapacityGroups", id);
    if (!record || record.tenantId !== tenantId) return null;
    return capacityGroupFromRecord(record);
  }

  async findByCode(tenantId: string, code: CapacityGroupCode): Promise<CapacityGroup | null> {
    const records = await tpvGetAllByIndex<CapacityGroupRecord>("tpvCapacityGroups", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? capacityGroupFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<CapacityGroup[]> {
    const records = await tpvGetAllByIndex<CapacityGroupRecord>("tpvCapacityGroups", "tenantId", tenantId);
    return records.map(capacityGroupFromRecord);
  }

  async save(group: CapacityGroup): Promise<void> {
    try {
      await tpvPut("tpvCapacityGroups", capacityGroupToRecord(group));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new CapacityGroupCodeAlreadyExistsError(group.tenantId, group.code.toString());
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<CapacityGroupRecord>("tpvCapacityGroups", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvCapacityGroups", id);
  }
}
