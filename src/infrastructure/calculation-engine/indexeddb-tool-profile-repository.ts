import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolCorrection } from "@/domain/calculation-engine/profiles/tool-correction";
import { ToolProfileSnapshot } from "@/domain/calculation-engine/profiles/tool-profile-snapshot";
import { ExternalReferenceRepository } from "@/domain/repositories/external-reference-repository";
import { ToolProfileRecord, ToolCorrectionRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { toolProfileToRecord, toolProfileFromRecord, toolCorrectionToRecord, toolCorrectionFromRecord } from "./profile-mappers";

/**
 * IndexedDB implementace `ToolProfileRepository` (AP-MCE-001 Fáze B §8) - viz
 * `IndexedDbMaterialProfileRepository` pro plné zdůvodnění vzoru
 * (`ToolProfile.id === Tool.id`, stejná identita jako materiál).
 */
export class IndexedDbToolProfileRepository implements ToolProfileRepository {
  constructor(private readonly externalReferenceRepository: ExternalReferenceRepository) {}

  async getById(id: string, tenantId: string): Promise<ToolProfile | null> {
    const record = await tpvGet<ToolProfileRecord>("tpvToolProfiles", id);
    if (!record || record.tenantId !== tenantId) return null;
    return toolProfileFromRecord(record);
  }

  async findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<ToolProfile | null> {
    const references = await this.externalReferenceRepository.listByExternalSystem(tenantId, externalSystemId);
    const reference = references.find((r) => r.localEntityType === "tool" && r.externalId === externalId);
    if (!reference) return null;
    return this.getById(reference.localEntityId, tenantId);
  }

  async listByTenant(tenantId: string): Promise<ToolProfile[]> {
    const records = await tpvGetAllByIndex<ToolProfileRecord>("tpvToolProfiles", "tenantId", tenantId);
    return records.map(toolProfileFromRecord);
  }

  async save(profile: ToolProfile): Promise<void> {
    await tpvPut("tpvToolProfiles", toolProfileToRecord(profile));
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

  async getSnapshot(id: string, tenantId: string): Promise<ToolProfileSnapshot | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return null;
    return ToolProfileSnapshot.forToolProfile(existing, {
      systemVersion: existing.recordVersion,
      createdAt: new Date().toISOString(),
    });
  }

  async findCorrectionByProfileId(toolProfileId: string, tenantId: string): Promise<ToolCorrection | null> {
    const records = await tpvGetAllByIndex<ToolCorrectionRecord>("tpvToolCorrections", "tenantId", tenantId);
    const match = records.find((r) => r.toolProfileId === toolProfileId && !r.archivedAt);
    return match ? toolCorrectionFromRecord(match) : null;
  }

  async saveCorrection(correction: ToolCorrection): Promise<void> {
    await tpvPut("tpvToolCorrections", toolCorrectionToRecord(correction));
  }
}
