import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MaterialProfile } from "@/domain/calculation-engine/profiles/material-profile";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { MaterialProfileSnapshot } from "@/domain/calculation-engine/profiles/material-profile-snapshot";
import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";
import { MaterialProfileRecord, MaterialCorrectionRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { materialProfileToRecord, materialProfileFromRecord, materialCorrectionToRecord, materialCorrectionFromRecord } from "./profile-mappers";

/**
 * IndexedDB implementace `MaterialProfileRepository` (AP-MCE-001 Fáze B §8) -
 * stejný `tpvGet`/`tpvGetAllByIndex`/`tpvPut` základ jako Fáze A
 * `IndexedDbCalculationRepository`, žádná druhá databáze. `findByExternal
 * Reference` deleguje na existující `ExternalReferenceRepository` (§9 -
 * appka nesmí znát konkrétní ERP jména) a najde profil přes `MaterialProfile.
 * id === Material.id` (`localEntityType: "material"`, `localEntityId ===
 * MaterialProfile.id`).
 */
export class IndexedDbMaterialProfileRepository implements MaterialProfileRepository {
  constructor(private readonly externalReferenceRepository: ExternalReferenceRepository) {}

  async getById(id: string, tenantId: string): Promise<MaterialProfile | null> {
    const record = await tpvGet<MaterialProfileRecord>("tpvMaterialProfiles", id);
    if (!record || record.tenantId !== tenantId) return null;
    return materialProfileFromRecord(record);
  }

  async findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<MaterialProfile | null> {
    const references = await this.externalReferenceRepository.listByExternalSystem(tenantId, externalSystemId);
    const reference = references.find((r) => r.localEntityType === "material" && r.externalId === externalId);
    if (!reference) return null;
    return this.getById(reference.localEntityId, tenantId);
  }

  async listByTenant(tenantId: string): Promise<MaterialProfile[]> {
    const records = await tpvGetAllByIndex<MaterialProfileRecord>("tpvMaterialProfiles", "tenantId", tenantId);
    return records.map(materialProfileFromRecord);
  }

  async save(profile: MaterialProfile): Promise<void> {
    await tpvPut("tpvMaterialProfiles", materialProfileToRecord(profile));
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

  async getSnapshot(id: string, tenantId: string): Promise<MaterialProfileSnapshot | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return null;
    return MaterialProfileSnapshot.forMaterialProfile(existing, {
      systemVersion: existing.recordVersion,
      createdAt: new Date().toISOString(),
    });
  }

  async findCorrectionByProfileId(materialProfileId: string, tenantId: string): Promise<MaterialCorrection | null> {
    const records = await tpvGetAllByIndex<MaterialCorrectionRecord>("tpvMaterialCorrections", "tenantId", tenantId);
    const match = records.find((r) => r.materialProfileId === materialProfileId && !r.archivedAt);
    return match ? materialCorrectionFromRecord(match) : null;
  }

  async saveCorrection(correction: MaterialCorrection): Promise<void> {
    await tpvPut("tpvMaterialCorrections", materialCorrectionToRecord(correction));
  }
}
