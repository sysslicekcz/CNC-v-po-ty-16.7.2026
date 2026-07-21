import { InspectionEquipmentProfile } from "../inspection/inspection-equipment-profile";
import { InspectionEquipmentProfileSnapshot } from "../inspection/inspection-equipment-profile-snapshot";

/** Tenant-scoped port pro `InspectionEquipmentProfile` (AP-MCE-001 Fáze F
 *  §9) - stejný tvar jako `ToolProfileRepository` (bez `Correction`, žádnou
 *  korekci nad kontrolním vybavením zadání nežádá). */
export interface InspectionEquipmentProfileRepository {
  getById(id: string, tenantId: string): Promise<InspectionEquipmentProfile | null>;
  listByTenant(tenantId: string): Promise<InspectionEquipmentProfile[]>;
  save(profile: InspectionEquipmentProfile): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  getSnapshot(id: string, tenantId: string): Promise<InspectionEquipmentProfileSnapshot | null>;
}
