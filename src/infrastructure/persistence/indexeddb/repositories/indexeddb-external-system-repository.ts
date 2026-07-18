import { ExternalSystemRepository } from "@/domain/repositories/external-system-repository";
import { ExternalSystem } from "@/domain/integrations/external-system";
import { ExternalSystemCodeAlreadyExistsError } from "@/domain/errors/external-system-code-already-exists-error";
import { ExternalSystemRecord } from "../records";
import { externalSystemToRecord, externalSystemFromRecord } from "../mappers/external-system-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped stejně jako IndexedDbMachineRepository/IndexedDbCapacityGroupRepository -
 *  jeden tenant může mít víc externích systémů, `code` je unikátní jen v rámci
 *  `[tenantId, code]`, hlídá primárně use case a jako pojistka unikátní index. */
export class IndexedDbExternalSystemRepository implements ExternalSystemRepository {
  async findById(id: string, tenantId: string): Promise<ExternalSystem | null> {
    const record = await tpvGet<ExternalSystemRecord>("tpvExternalSystems", id);
    if (!record || record.tenantId !== tenantId) return null;
    return externalSystemFromRecord(record);
  }

  async findByCode(tenantId: string, code: string): Promise<ExternalSystem | null> {
    const records = await tpvGetAllByIndex<ExternalSystemRecord>("tpvExternalSystems", "tenantId", tenantId);
    const match = records.find((r) => r.code === code);
    return match ? externalSystemFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<ExternalSystem[]> {
    const records = await tpvGetAllByIndex<ExternalSystemRecord>("tpvExternalSystems", "tenantId", tenantId);
    return records.map(externalSystemFromRecord);
  }

  async count(tenantId: string): Promise<number> {
    const records = await tpvGetAllByIndex<ExternalSystemRecord>("tpvExternalSystems", "tenantId", tenantId);
    return records.length;
  }

  async save(system: ExternalSystem): Promise<void> {
    try {
      await tpvPut("tpvExternalSystems", externalSystemToRecord(system));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new ExternalSystemCodeAlreadyExistsError(system.tenantId, system.code);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ExternalSystemRecord>("tpvExternalSystems", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvExternalSystems", id);
  }
}
