import { Machine, MachineStatus, MachineCategory } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { MachineRecord } from "../records";
import { LegacyStamp, hourlyRateToRecord, hourlyRateFromRecord, parseEntityStavLike } from "./common";

const STATUS_VALUES = ["active", "inactive"] as const satisfies readonly MachineStatus[];
const CATEGORY_VALUES = [
  "lathe",
  "milling",
  "turn_mill",
  "grinding",
  "drilling",
  "saw",
  "inspection",
  "assembly",
  "other",
] as const satisfies readonly MachineCategory[];

/** Bez createdAt/updatedAt - ta spravuje výhradně repository (audit pole, ne
 *  součást domény, viz records/machine-tool-records.ts). */
export type MachineRecordWithoutTimestamps = Omit<MachineRecord, "createdAt" | "updatedAt">;

export function machineToRecord(machine: Machine, legacy: LegacyStamp = {}): MachineRecordWithoutTimestamps {
  return {
    id: machine.id,
    tenantId: machine.tenantId,
    code: machine.code.toString(),
    name: machine.name,
    designation: machine.designation,
    category: machine.category,
    manufacturer: machine.manufacturer,
    model: machine.model,
    maxRpm: machine.maxRpm,
    maxPowerKw: machine.maxPowerKw,
    hourlyRate: hourlyRateToRecord(machine.hourlyRate),
    status: machine.status,
    note: machine.note,
    capacityGroupId: machine.capacityGroupId,
    ...legacy,
  };
}

export function machineFromRecord(record: MachineRecord): Machine {
  return Machine.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: MachineCode.create(record.code),
    name: record.name,
    designation: record.designation,
    category: record.category ? parseEntityStavLike(record.category, CATEGORY_VALUES, "Machine.category") : undefined,
    manufacturer: record.manufacturer,
    model: record.model,
    maxRpm: record.maxRpm,
    maxPowerKw: record.maxPowerKw,
    hourlyRate: hourlyRateFromRecord(record.hourlyRate),
    status: parseEntityStavLike(record.status, STATUS_VALUES, "Machine.status"),
    note: record.note,
    capacityGroupId: record.capacityGroupId,
  });
}
