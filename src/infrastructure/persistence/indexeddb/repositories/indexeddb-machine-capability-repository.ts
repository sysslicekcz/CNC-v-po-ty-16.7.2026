import { MachineCapabilityRepository } from "@/domain/repositories/machine-capability-repository";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { MachineCapabilityRecord } from "../records";
import { machineCapabilityToRecord, machineCapabilityFromRecord } from "../mappers/machine-capability-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAll, tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

export class IndexedDbMachineCapabilityRepository implements MachineCapabilityRepository {
  async findById(id: string): Promise<MachineCapability | null> {
    const record = await tpvGet<MachineCapabilityRecord>("tpvMachineCapabilities", id);
    return record ? machineCapabilityFromRecord(record) : null;
  }

  async findAll(): Promise<MachineCapability[]> {
    const records = await tpvGetAll<MachineCapabilityRecord>("tpvMachineCapabilities");
    return records.map(machineCapabilityFromRecord);
  }

  async save(capability: MachineCapability): Promise<void> {
    const existing = await tpvGet<MachineCapabilityRecord>("tpvMachineCapabilities", capability.id);
    await tpvPut(
      "tpvMachineCapabilities",
      machineCapabilityToRecord(capability, {
        legacySource: existing?.legacySource,
        legacyId: existing?.legacyId,
        migrationRunId: existing?.migrationRunId,
      })
    );
  }

  async saveWithLegacyStamp(capability: MachineCapability, stamp: LegacyStamp): Promise<void> {
    await tpvPut("tpvMachineCapabilities", machineCapabilityToRecord(capability, stamp));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvMachineCapabilities", id);
  }

  async findByMachineId(machineId: string): Promise<MachineCapability[]> {
    const records = await tpvGetAllByIndex<MachineCapabilityRecord>("tpvMachineCapabilities", "machineId", machineId);
    return records.map(machineCapabilityFromRecord);
  }
}
