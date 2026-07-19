import { ExternalOperationResource, ExternalResourceStatus } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { ExternalOperationResourceRecord } from "../records";
import { parseEntityStavLike, moneyToRecord, moneyFromRecord } from "./common";

const STATUS_VALUES = ["active", "inactive"] as const satisfies readonly ExternalResourceStatus[];

export function externalOperationResourceToRecord(resource: ExternalOperationResource): ExternalOperationResourceRecord {
  return {
    id: resource.id,
    tenantId: resource.tenantId,
    code: resource.code.toString(),
    name: resource.name,
    supplierId: resource.supplierId,
    supportedOperationTypeIds: resource.supportedOperationTypeIds ? [...resource.supportedOperationTypeIds] : undefined,
    defaultLeadTimeDays: resource.defaultLeadTimeDays,
    defaultCost: moneyToRecord(resource.defaultCost),
    status: resource.status,
    note: resource.note,
  };
}

export function externalOperationResourceFromRecord(record: ExternalOperationResourceRecord): ExternalOperationResource {
  return ExternalOperationResource.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: ExternalResourceCode.create(record.code),
    name: record.name,
    supplierId: record.supplierId,
    supportedOperationTypeIds: record.supportedOperationTypeIds,
    defaultLeadTimeDays: record.defaultLeadTimeDays,
    defaultCost: moneyFromRecord(record.defaultCost),
    status: parseEntityStavLike(record.status, STATUS_VALUES, "ExternalOperationResource.status"),
    note: record.note,
  });
}
