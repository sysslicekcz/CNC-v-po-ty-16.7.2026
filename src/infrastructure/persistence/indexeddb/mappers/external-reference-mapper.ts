import { ExternalReference, ExternalReferenceEntityType } from "@/domain/integrations/external-reference";
import { ExternalReferenceRecord } from "../records";
import { parseEntityStavLike } from "./common";

const LOCAL_ENTITY_TYPE_VALUES = [
  "customer",
  "order",
  "part",
  "routingSheet",
  "operation",
  "machine",
  "capacityGroup",
  "operationType",
  "tool",
  "externalOperationResource",
  "material",
] as const satisfies readonly ExternalReferenceEntityType[];

export function externalReferenceToRecord(reference: ExternalReference): ExternalReferenceRecord {
  return {
    id: reference.id,
    tenantId: reference.tenantId,
    externalSystemId: reference.externalSystemId,
    localEntityType: reference.localEntityType,
    localEntityId: reference.localEntityId,
    externalEntityType: reference.externalEntityType,
    externalId: reference.externalId,
    externalCode: reference.externalCode,
    createdAt: reference.createdAt,
    updatedAt: reference.updatedAt,
  };
}

export function externalReferenceFromRecord(record: ExternalReferenceRecord): ExternalReference {
  return ExternalReference.restore({
    id: record.id,
    tenantId: record.tenantId,
    externalSystemId: record.externalSystemId,
    localEntityType: parseEntityStavLike(record.localEntityType, LOCAL_ENTITY_TYPE_VALUES, "ExternalReference.localEntityType"),
    localEntityId: record.localEntityId,
    externalEntityType: record.externalEntityType,
    externalId: record.externalId,
    externalCode: record.externalCode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
