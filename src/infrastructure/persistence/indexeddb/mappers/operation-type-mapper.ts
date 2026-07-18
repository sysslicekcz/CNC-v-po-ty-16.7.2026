import { OperationType } from "@/domain/entities/operation-type";
import { OperationTypeRecord } from "../records";
import { parseEntityStav, parseOperationCategory } from "./common";

export function operationTypeToRecord(operationType: OperationType): OperationTypeRecord {
  return {
    id: operationType.id,
    kod: operationType.kod,
    nazev: operationType.nazev,
    kategorie: operationType.kategorie,
    stav: operationType.stav,
    popis: operationType.popis,
  };
}

export function operationTypeFromRecord(record: OperationTypeRecord): OperationType {
  return OperationType.create({
    id: record.id,
    kod: record.kod,
    nazev: record.nazev,
    kategorie: parseOperationCategory(record.kategorie),
    stav: parseEntityStav(record.stav, "OperationType"),
    popis: record.popis,
  });
}
