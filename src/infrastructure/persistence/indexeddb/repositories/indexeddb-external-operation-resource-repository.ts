import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { ExternalResourceCodeAlreadyExistsError } from "@/domain/errors/external-resource-code-already-exists-error";
import { ExternalOperationResourceRecord } from "../records";
import { externalOperationResourceToRecord, externalOperationResourceFromRecord } from "../mappers/external-operation-resource-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped stejně jako IndexedDbMachineRepository/IndexedDbCapacityGroupRepository. */
export class IndexedDbExternalOperationResourceRepository implements ExternalOperationResourceRepository {
  async findById(id: string, tenantId: string): Promise<ExternalOperationResource | null> {
    const record = await tpvGet<ExternalOperationResourceRecord>("tpvExternalOperationResources", id);
    if (!record || record.tenantId !== tenantId) return null;
    return externalOperationResourceFromRecord(record);
  }

  async findByCode(tenantId: string, code: ExternalResourceCode): Promise<ExternalOperationResource | null> {
    const records = await tpvGetAllByIndex<ExternalOperationResourceRecord>(
      "tpvExternalOperationResources",
      "tenantId",
      tenantId
    );
    const match = records.find((r) => r.code === code.toString());
    return match ? externalOperationResourceFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<ExternalOperationResource[]> {
    const records = await tpvGetAllByIndex<ExternalOperationResourceRecord>(
      "tpvExternalOperationResources",
      "tenantId",
      tenantId
    );
    return records.map(externalOperationResourceFromRecord);
  }

  async save(resource: ExternalOperationResource): Promise<void> {
    try {
      await tpvPut("tpvExternalOperationResources", externalOperationResourceToRecord(resource));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new ExternalResourceCodeAlreadyExistsError(resource.tenantId, resource.code.toString());
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<ExternalOperationResourceRecord>("tpvExternalOperationResources", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvExternalOperationResources", id);
  }
}
