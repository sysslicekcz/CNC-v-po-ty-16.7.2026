import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { OperationType } from "@/domain/entities/operation-type";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { OperationTypeRecord } from "../records";
import { operationTypeToRecord, operationTypeFromRecord } from "../mappers/operation-type-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped od Kroku 5 - viz docs/audits/step-5-audit.md, riziko migrace č. 1. */
export class IndexedDbOperationTypeRepository implements OperationTypeRepository {
  async findById(id: string, tenantId: string): Promise<OperationType | null> {
    const record = await tpvGet<OperationTypeRecord>("tpvOperationTypes", id);
    if (!record || record.tenantId !== tenantId) return null;
    return operationTypeFromRecord(record);
  }

  async findByCode(tenantId: string, kod: string): Promise<OperationType | null> {
    const records = await tpvGetAllByIndex<OperationTypeRecord>("tpvOperationTypes", "tenantId", tenantId);
    const match = records.find((r) => r.kod === kod);
    return match ? operationTypeFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<OperationType[]> {
    const records = await tpvGetAllByIndex<OperationTypeRecord>("tpvOperationTypes", "tenantId", tenantId);
    return records.map(operationTypeFromRecord);
  }

  async save(operationType: OperationType): Promise<void> {
    try {
      await tpvPut("tpvOperationTypes", operationTypeToRecord(operationType));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MasterDataCodeAlreadyExistsError("Typ operace", operationType.tenantId, operationType.kod);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<OperationTypeRecord>("tpvOperationTypes", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvOperationTypes", id);
  }
}
