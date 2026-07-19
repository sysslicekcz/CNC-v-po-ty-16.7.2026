import { OperationTypeCapabilityRequirement } from "../entities/operation-type-capability-requirement";

export interface OperationTypeCapabilityRequirementRepository {
  findById(id: string, tenantId: string): Promise<OperationTypeCapabilityRequirement | null>;
  findByOperationTypeId(operationTypeId: string, tenantId: string): Promise<OperationTypeCapabilityRequirement[]>;
  save(requirement: OperationTypeCapabilityRequirement): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
