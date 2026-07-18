import { MachineRepository } from "@/domain/repositories/machine-repository";
import { Machine } from "@/domain/entities/machine";
import { MachineRecord } from "../records";
import { machineToRecord, machineFromRecord } from "../mappers/machine-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbMachineRepository implements MachineRepository {
  async findById(id: string): Promise<Machine | null> {
    const record = await tpvGet<MachineRecord>("tpvMachines", id);
    return record ? machineFromRecord(record) : null;
  }

  async findAll(): Promise<Machine[]> {
    const records = await tpvGetAll<MachineRecord>("tpvMachines");
    return records.map(machineFromRecord);
  }

  async save(machine: Machine): Promise<void> {
    const existing = await tpvGet<MachineRecord>("tpvMachines", machine.id);
    await tpvPut(
      "tpvMachines",
      machineToRecord(machine, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(machine: Machine, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvMachines", machineToRecord(machine, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvMachines", id);
  }
}
