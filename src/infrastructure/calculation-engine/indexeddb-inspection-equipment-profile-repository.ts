import { InspectionEquipmentProfileRepository } from "@/domain/calculation-engine/repositories/inspection-equipment-profile-repository";
import { InspectionEquipmentProfile } from "@/domain/calculation-engine/inspection/inspection-equipment-profile";
import { InspectionEquipmentProfileSnapshot } from "@/domain/calculation-engine/inspection/inspection-equipment-profile-snapshot";
import { InspectionEquipmentProfileRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { inspectionEquipmentProfileToRecord, inspectionEquipmentProfileFromRecord } from "./manual-inspection-mappers";

/**
 * IndexedDB implementace `InspectionEquipmentProfileRepository` (AP-MCE-001
 * Fáze F §9) - stejný vzor jako `IndexedDbToolProfileRepository` (Fáze B).
 */
export class IndexedDbInspectionEquipmentProfileRepository implements InspectionEquipmentProfileRepository {
  async getById(id: string, tenantId: string): Promise<InspectionEquipmentProfile | null> {
    const record = await tpvGet<InspectionEquipmentProfileRecord>("tpvInspectionEquipmentProfiles", id);
    if (!record || record.tenantId !== tenantId) return null;
    return inspectionEquipmentProfileFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<InspectionEquipmentProfile[]> {
    const records = await tpvGetAllByIndex<InspectionEquipmentProfileRecord>("tpvInspectionEquipmentProfiles", "tenantId", tenantId);
    return records.map(inspectionEquipmentProfileFromRecord);
  }

  async save(profile: InspectionEquipmentProfile): Promise<void> {
    await tpvPut("tpvInspectionEquipmentProfiles", inspectionEquipmentProfileToRecord(profile));
  }

  async archive(id: string, tenantId: string, archivedAt: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return;
    await this.save(existing.archive(archivedAt));
  }

  async getSnapshot(id: string, tenantId: string): Promise<InspectionEquipmentProfileSnapshot | null> {
    const existing = await this.getById(id, tenantId);
    if (!existing) return null;
    return InspectionEquipmentProfileSnapshot.forInspectionEquipmentProfile(existing, {
      systemVersion: existing.recordVersion,
      createdAt: new Date().toISOString(),
    });
  }
}
