import { Machine, MachineStatus } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { MachineRecord } from "../records";
import { LegacyStamp, hourlyRateToRecord, hourlyRateFromRecord, parseEntityStavLike } from "./common";

const STATUS_VALUES = ["active", "inactive"] as const satisfies readonly MachineStatus[];

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
    maxRpm: machine.maxRpm,
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
    maxRpm: record.maxRpm,
    hourlyRate: hourlyRateFromRecord(record.hourlyRate),
    status: parseEntityStavLike(record.status, STATUS_VALUES, "Machine.status"),
    note: record.note,
    capacityGroupId: record.capacityGroupId,
  });
}
