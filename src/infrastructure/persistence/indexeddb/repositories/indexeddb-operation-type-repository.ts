import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { OperationType } from "@/domain/entities/operation-type";
import { OperationTypeRecord } from "../records";
import { operationTypeToRecord, operationTypeFromRecord } from "../mappers/operation-type-mapper";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbOperationTypeRepository implements OperationTypeRepository {
  async findById(id: string): Promise<OperationType | null> {
    const record = await tpvGet<OperationTypeRecord>("tpvOperationTypes", id);
    return record ? operationTypeFromRecord(record) : null;
  }

  async findAll(): Promise<OperationType[]> {
    const records = await tpvGetAll<OperationTypeRecord>("tpvOperationTypes");
    return records.map(operationTypeFromRecord);
  }

  async save(operationType: OperationType): Promise<void> {
    await tpvPut("tpvOperationTypes", operationTypeToRecord(operationType));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvOperationTypes", id);
  }
}
