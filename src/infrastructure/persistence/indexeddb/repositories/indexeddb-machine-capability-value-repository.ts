import { MachineCapabilityValueRepository } from "@/domain/repositories/machine-capability-value-repository";
import { MachineCapabilityValue } from "@/domain/entities/machine-capability-value";
import { ConflictError } from "@/domain/errors/conflict-error";
import { MachineCapabilityValueRecord } from "../records";
import { machineCapabilityValueToRecord, machineCapabilityValueFromRecord } from "../mappers/machine-capability-value-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export class IndexedDbMachineCapabilityValueRepository implements MachineCapabilityValueRepository {
  async findById(id: string, tenantId: string): Promise<MachineCapabilityValue | null> {
    const record = await tpvGet<MachineCapabilityValueRecord>("tpvMachineCapabilityValues", id);
    if (!record || record.tenantId !== tenantId) return null;
    return machineCapabilityValueFromRecord(record);
  }

  async findByMachineId(machineId: string, tenantId: string): Promise<MachineCapabilityValue[]> {
    const records = await tpvGetAllByIndex<MachineCapabilityValueRecord>("tpvMachineCapabilityValues", "machineId", machineId);
    return records.filter((r) => r.tenantId === tenantId).map(machineCapabilityValueFromRecord);
  }

  async findByCapabilityTypeId(capabilityTypeId: string, tenantId: string): Promise<MachineCapabilityValue[]> {
    const records = await tpvGetAllByIndex<MachineCapabilityValueRecord>(
      "tpvMachineCapabilityValues",
      "capabilityTypeId",
      capabilityTypeId
    );
    return records.filter((r) => r.tenantId === tenantId).map(machineCapabilityValueFromRecord);
  }

  async save(value: MachineCapabilityValue): Promise<void> {
    try {
      await tpvPut("tpvMachineCapabilityValues", machineCapabilityValueToRecord(value));
    } catch (error) {
      if (isConstraintError(error)) {
        throw new ConflictError(`Stroj už má hodnotu pro tuto capabilitu (machineId="${value.machineId}").`);
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<MachineCapabilityValueRecord>("tpvMachineCapabilityValues", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvMachineCapabilityValues", id);
  }
}
