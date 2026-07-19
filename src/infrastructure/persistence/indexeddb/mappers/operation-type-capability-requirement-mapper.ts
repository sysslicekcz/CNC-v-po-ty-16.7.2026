import { OperationTypeCapabilityRequirement } from "@/domain/entities/operation-type-capability-requirement";
import { OperationTypeCapabilityRequirementRecord } from "../records";
import { parseCapabilityRequirementKind } from "./common";

export function operationTypeCapabilityRequirementToRecord(
  req: OperationTypeCapabilityRequirement
): OperationTypeCapabilityRequirementRecord {
  return {
    id: req.id,
    tenantId: req.tenantId,
    operationTypeId: req.operationTypeId,
    capabilityTypeId: req.capabilityTypeId,
    requirement: req.requirement,
    expectedValue: req.expectedValue,
  };
}

export function operationTypeCapabilityRequirementFromRecord(
  record: OperationTypeCapabilityRequirementRecord
): OperationTypeCapabilityRequirement {
  return OperationTypeCapabilityRequirement.restore({
    id: record.id,
    tenantId: record.tenantId,
    operationTypeId: record.operationTypeId,
    capabilityTypeId: record.capabilityTypeId,
    requirement: parseCapabilityRequirementKind(record.requirement),
    expectedValue: record.expectedValue,
  });
}
