import { Part } from "@/domain/entities/part";
import { PartRecord } from "../records";
import { LegacyStamp, quantityToRecord, quantityFromRecord } from "./common";

export function partToRecord(part: Part, legacy: LegacyStamp = {}): PartRecord {
  return {
    id: part.id,
    orderId: part.orderId,
    nazev: part.nazev,
    mnozstvi: quantityToRecord(part.mnozstvi),
    cisloVykresu: part.cisloVykresu,
    revizeVykresu: part.revizeVykresu,
    material: part.material,
    polotovar: part.polotovar,
    poznamka: part.poznamka,
    dokumentaceRef: part.dokumentaceRef,
    ...legacy,
  };
}

export function partFromRecord(record: PartRecord): Part {
  return Part.restore({
    id: record.id,
    orderId: record.orderId,
    nazev: record.nazev,
    mnozstvi: quantityFromRecord(record.mnozstvi),
    cisloVykresu: record.cisloVykresu,
    revizeVykresu: record.revizeVykresu,
    material: record.material,
    polotovar: record.polotovar,
    poznamka: record.poznamka,
    dokumentaceRef: record.dokumentaceRef,
  });
}
