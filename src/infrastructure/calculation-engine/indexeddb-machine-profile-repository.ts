import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineCorrection } from "@/domain/calculation-engine/profiles/machine-correction";
import { MachineProfileSnapshot } from "@/domain/calculation-engine/profiles/machine-profile-snapshot";
import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";
import { MachineProfileRecord, MachineCorrectionRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { machineProfileToRecord, machineProfileFromRecord, machineCorrectionToRecord, machineCorrectionFromRecord } from "./profile-mappers";

/**
 * IndexedDB implementace `MachineProfileRepository` (AP-MCE-001 Fáze B §8) -
 * viz `IndexedDbMaterialProfileRepository` pro plné zdůvodnění vzoru.
 * `findByExternalReference` se liší od materiálu/nástroje: `MachineProfile.id`
 * ZÁMĚRNĚ NENÍ `Machine.id` (viz `MachineProfile.physicalMachineId`), takže
 * ERP odkaz (`localEntityType: "machine"`, `localEntityId === Machine.id`)
 * vede k `physicalMachineId`, ne přímo k `id` profilu - druhý krok hledá
 * profil podle `physicalMachineId` (index `physicalMachineId`).
 */
export class IndexedDbMachineProfileRepository implements MachineProfileRepository {
  constructor(private readonly externalReferenceRepository: ExternalReferenceRepository) {}

  async getById(id: string, tenantId: string): Promise<MachineProfile | null> {
    const record = await tpvGet<MachineProfileRecord>("tpvMachineProfiles", id);
    if (!record || record.tenantId !== tenantId) return null;
    return machineProfileFromRecord(record);
  }

  async findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<MachineProfile | null> {
    const references = await this.externalReferenceRepository.listByExternalSystem(tenantId, externalSystemId);
    const reference = references.find((r) => r.localEntityType === "machine" && r.externalId === externalId);
    if (!reference) return null;

    const records = await tpvGetAllByIndex<MachineProfileRecord>("tpvMachineProfiles", "physicalMachineId", reference.localEntityId);
    const match = records.find((r) => r.tenantId === tenantId);
    return match ? machineProfileFromRecord(match) : null;
  }

  async listByTenant(tenantId: string): Promise<MachineProfile[]> {
    const records = await tpvGetAllByIndex<MachineProfileRecord>("tpvMachineProfiles", "tenantId", tenantId);
    return records.map(machineProfileFromRecord);
  }

  async save(profile: MachineProfile): Promise<void> {
    await tpvPut("tpvMachineProfiles", machineProfileToRecord(profile));
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(existing.archive(archivedAt));
  }

  async getVersion(id: string, tenantId: string): Promise<number | null> {
    const existing = await this.getById(id, tenantId);
    return existing ? existing.recordVersion : null;
  }

  async getSnapshot(id: string, tenantId: string): Promise<MachineProfileSnapshot | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return null;
    return MachineProfileSnapshot.forMachineProfile(existing, {
      systemVersion: existing.recordVersion,
      createdAt: new Date().toISOString(),
    });
  }

  async findCorrectionByProfileId(machineProfileId: string, tenantId: string): Promise<MachineCorrection | null> {
    const records = await tpvGetAllByIndex<MachineCorrectionRecord>("tpvMachineCorrections", "tenantId", tenantId);
    const match = records.find((r) => r.machineProfileId === machineProfileId && !r.archivedAt);
    return match ? machineCorrectionFromRecord(match) : null;
  }

  async saveCorrection(correction: MachineCorrection): Promise<void> {
    await tpvPut("tpvMachineCorrections", machineCorrectionToRecord(correction));
  }
}
