import { MachineRepository } from "@/domain/repositories/machine-repository";
import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { MachineCodeAlreadyExistsError } from "@/domain/errors/machine-code-already-exists-error";
import { MachineRecord } from "../records";
import { machineToRecord, machineFromRecord } from "../mappers/machine-mapper";
import { LegacyStamp } from "../mappers/common";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

/** Tenant-scoped (docs/adr/0019) - `findById`/`delete` vždy ověří, že záznam
 *  patří danému tenantovi, ne že spoléhají na to, že cizí id nikdo neuhodne.
 *  Unikátnost `[tenantId, code]` hlídá jak use case (findByCode před save,
 *  viz CreateMachineUseCase), tak IndexedDB unikátní index jako poslední
 *  pojistka - ConstraintError se tu překládá na doménovou
 *  MachineCodeAlreadyExistsError. */
export class IndexedDbMachineRepository implements MachineRepository {
  async findById(id: string, tenantId: string): Promise<Machine | null> {
    const record = await tpvGet<MachineRecord>("tpvMachines", id);
    if (!record || record.tenantId !== tenantId) return null;
    return machineFromRecord(record);
  }

  async findByCode(tenantId: string, code: MachineCode): Promise<Machine | null> {
    const records = await tpvGetAllByIndex<MachineRecord>("tpvMachines", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? machineFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<Machine[]> {
    const records = await tpvGetAllByIndex<MachineRecord>("tpvMachines", "tenantId", tenantId);
    return records.map(machineFromRecord);
  }

  async count(tenantId: string): Promise<number> {
    const records = await tpvGetAllByIndex<MachineRecord>("tpvMachines", "tenantId", tenantId);
    return records.length;
  }

  async save(machine: Machine): Promise<void> {
    const existing = await tpvGet<MachineRecord>("tpvMachines", machine.id);
    await this.write(machine, {
      legacySource: existing?.legacySource,
      legacyId: existing?.legacyId,
      migrationRunId: existing?.migrationRunId,
    });
  }

  /** Jen pro infrastructure/migration. */
  async saveWithLegacyStamp(machine: Machine, stamp: LegacyStamp): Promise<void> {
    await this.write(machine, stamp);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<MachineRecord>("tpvMachines", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvMachines", id);
  }

  private async write(machine: Machine, legacy: LegacyStamp): Promise<void> {
    const existing = await tpvGet<MachineRecord>("tpvMachines", machine.id);
    const now = new Date().toISOString();
    const record: MachineRecord = {
      ...machineToRecord(machine, legacy),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await tpvPut("tpvMachines", record);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new MachineCodeAlreadyExistsError(machine.tenantId, machine.code.toString());
      }
      throw error;
    }
  }
}
