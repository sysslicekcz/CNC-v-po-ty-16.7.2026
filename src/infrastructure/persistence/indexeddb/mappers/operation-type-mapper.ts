import { OperationType } from "@/domain/entities/operation-type";
import { OperationTypeRecord } from "../records";
import { parseEntityStav, parseOperationCategory, parseOperationTypeResourceRequirement } from "./common";

export function operationTypeToRecord(operationType: OperationType): OperationTypeRecord {
  return {
    id: operationType.id,
    tenantId: operationType.tenantId,
    kod: operationType.kod,
    nazev: operationType.nazev,
    kategorie: operationType.kategorie,
    resourceRequirement: operationType.resourceRequirement,
    requiresSetupTime: operationType.requiresSetupTime,
    requiresUnitTime: operationType.requiresUnitTime,
    stav: operationType.stav,
    popis: operationType.popis,
  };
}

export function operationTypeFromRecord(record: OperationTypeRecord): OperationType {
  return OperationType.restore({
    id: record.id,
    tenantId: record.tenantId,
    kod: record.kod,
    nazev: record.nazev,
    kategorie: parseOperationCategory(record.kategorie),
    resourceRequirement: parseOperationTypeResourceRequirement(record.resourceRequirement),
    requiresSetupTime: record.requiresSetupTime,
    requiresUnitTime: record.requiresUnitTime,
    stav: parseEntityStav(record.stav, "OperationType"),
    popis: record.popis,
  });
}
