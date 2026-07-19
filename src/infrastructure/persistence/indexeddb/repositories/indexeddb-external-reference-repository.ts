import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";
import { ExternalReference, ExternalReferenceEntityType } from "@/domain/integrations/external-reference";
import { DuplicateExternalReferenceError } from "@/domain/errors/duplicate-external-reference-error";
import { ExternalReferenceRecord } from "../records";
import { externalReferenceToRecord, externalReferenceFromRecord } from "../mappers/external-reference-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped. Unikátnost `[externalSystemId, externalEntityType, externalId]`
 *  se hlídá primárně tady v `save()` (findByExternalId před zápisem) a jako
 *  poslední pojistka unikátním indexem v IndexedDB - stejný dvouvrstvý vzor
 *  jako `IndexedDbMachineRepository` (viz docs/step-3-5/machine-code-model.md). */
export class IndexedDbExternalReferenceRepository implements ExternalReferenceRepository {
  async findById(id: string, tenantId: string): Promise<ExternalReference | null> {
    const record = await tpvGet<ExternalReferenceRecord>("tpvExternalReferences", id);
    if (!record || record.tenantId !== tenantId) return null;
    return externalReferenceFromRecord(record);
  }

  async findByLocalEntity(
    tenantId: string,
    localEntityType: ExternalReferenceEntityType,
    localEntityId: string
  ): Promise<ExternalReference[]> {
    const records = await tpvGetAllByIndex<ExternalReferenceRecord>("tpvExternalReferences", "tenantId", tenantId);
    return records
      .filter((r) => r.localEntityType === localEntityType && r.localEntityId === localEntityId)
      .map(externalReferenceFromRecord);
  }

  async findByExternalId(
    tenantId: string,
    externalSystemId: string,
    externalEntityType: string,
    externalId: string
  ): Promise<ExternalReference[]> {
    const records = await tpvGetAllByIndex<ExternalReferenceRecord>("tpvExternalReferences", "tenantId", tenantId);
    return records
      .filter(
        (r) =>
          r.externalSystemId === externalSystemId && r.externalEntityType === externalEntityType && r.externalId === externalId
      )
      .map(externalReferenceFromRecord);
  }

  async listByExternalSystem(tenantId: string, externalSystemId: string): Promise<ExternalReference[]> {
    const records = await tpvGetAllByIndex<ExternalReferenceRecord>("tpvExternalReferences", "tenantId", tenantId);
    return records.filter((r) => r.externalSystemId === externalSystemId).map(externalReferenceFromRecord);
  }

  async save(reference: ExternalReference): Promise<void> {
    if (reference.externalId) {
      const existing = await this.findByExternalId(
        reference.tenantId,
        reference.externalSystemId,
        reference.externalEntityType,
        reference.externalId
      );
      const conflict = existing.find((r) => r.id !== reference.id);
      if (conflict) {
        throw new DuplicateExternalReferenceError(reference.externalSystemId, reference.externalEntityType, reference.externalId);
      }
    }
    try {
      await tpvPut("tpvExternalReferences", externalReferenceToRecord(reference));
    } catch (error) {
      if (isConstraintError(error) && reference.externalId) {
        throw new DuplicateExternalReferenceError(reference.externalSystemId, reference.externalEntityType, reference.externalId);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ExternalReferenceRecord>("tpvExternalReferences", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvExternalReferences", id);
  }
}
