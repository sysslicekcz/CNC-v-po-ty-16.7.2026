import { OperationTypeCapabilityRequirementRepository } from "@/domain/repositories/operation-type-capability-requirement-repository";
import { OperationTypeCapabilityRequirement } from "@/domain/entities/operation-type-capability-requirement";
import { OperationTypeCapabilityRequirementRecord } from "../records";
import {
  operationTypeCapabilityRequirementToRecord,
  operationTypeCapabilityRequirementFromRecord,
} from "../mappers/operation-type-capability-requirement-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbOperationTypeCapabilityRequirementRepository implements OperationTypeCapabilityRequirementRepository {
  async findById(id: string, tenantId: string): Promise<OperationTypeCapabilityRequirement | null> {
    const record = await tpvGet<OperationTypeCapabilityRequirementRecord>("tpvOperationTypeCapabilityRequirements", id);
    if (!record || record.tenantId !== tenantId) return null;
    return operationTypeCapabilityRequirementFromRecord(record);
  }

  async findByOperationTypeId(operationTypeId: string, tenantId: string): Promise<OperationTypeCapabilityRequirement[]> {
    const records = await tpvGetAllByIndex<OperationTypeCapabilityRequirementRecord>(
      "tpvOperationTypeCapabilityRequirements",
      "operationTypeId",
      operationTypeId
    );
    return records.filter((r) => r.tenantId === tenantId).map(operationTypeCapabilityRequirementFromRecord);
  }

  async save(requirement: OperationTypeCapabilityRequirement): Promise<void> {
    await tpvPut("tpvOperationTypeCapabilityRequirements", operationTypeCapabilityRequirementToRecord(requirement));
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<OperationTypeCapabilityRequirementRecord>("tpvOperationTypeCapabilityRequirements", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvOperationTypeCapabilityRequirements", id);
  }
}
