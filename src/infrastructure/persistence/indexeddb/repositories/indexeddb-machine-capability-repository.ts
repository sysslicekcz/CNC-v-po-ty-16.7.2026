import { MachineCapabilityRepository } from "@/domain/repositories/machine-capability-repository";
import { MachineCapability } from "@/domain/entities/machine-capability";
import { MachineCapabilityRecord } from "../records";
import { machineCapabilityToRecord, machineCapabilityFromRecord } from "../mappers/machine-capability-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

/** Tenant-scoped od Kroku 5 - `MachineCapability` mělo `tenantId` pole i index
 *  od Kroku 3.5, jen repository ho dosud nevyužívalo. */
export class IndexedDbMachineCapabilityRepository implements MachineCapabilityRepository {
  async findById(id: string, tenantId: string): Promise<MachineCapability | null> {
    const record = await tpvGet<MachineCapabilityRecord>("tpvMachineCapabilities", id);
    if (!record || record.tenantId !== tenantId) return null;
    return machineCapabilityFromRecord(record);
  }

  async list(tenantId: string): Promise<MachineCapability[]> {
    const records = await tpvGetAllByIndex<MachineCapabilityRecord>("tpvMachineCapabilities", "tenantId", tenantId);
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

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<MachineCapabilityRecord>("tpvMachineCapabilities", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvMachineCapabilities", id);
  }

  async findByMachineId(machineId: string, tenantId: string): Promise<MachineCapability[]> {
    const records = await tpvGetAllByIndex<MachineCapabilityRecord>("tpvMachineCapabilities", "machineId", machineId);
    return records.filter((r) => r.tenantId === tenantId).map(machineCapabilityFromRecord);
  }
}
