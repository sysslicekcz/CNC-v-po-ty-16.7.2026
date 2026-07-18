import { Machine } from "@/domain/entities/machine";
import { MachineRecord } from "../records";
import { LegacyStamp, hourlyRateToRecord, hourlyRateFromRecord, parseEntityStav } from "./common";

export function machineToRecord(machine: Machine, legacy: LegacyStamp = {}): MachineRecord {
  return {
    id: machine.id,
    nazev: machine.nazev,
    oznaceni: machine.oznaceni,
    maxOtacky: machine.maxOtacky,
    hourlyRate: hourlyRateToRecord(machine.hourlyRate),
    stav: machine.stav,
    poznamka: machine.poznamka,
    ...legacy,
  };
}

export function machineFromRecord(record: MachineRecord): Machine {
  return Machine.restore({
    id: record.id,
    nazev: record.nazev,
    oznaceni: record.oznaceni,
    maxOtacky: record.maxOtacky,
    hourlyRate: hourlyRateFromRecord(record.hourlyRate),
    stav: parseEntityStav(record.stav, "Machine"),
    poznamka: record.poznamka,
  });
}
