import { ProfileSnapshot } from "../shared/profile-snapshot";
import { InspectionEquipmentProfile } from "./inspection-equipment-profile";

/** Immutable snapshot `InspectionEquipmentProfile` v okamžiku výpočtu
 *  (AP-MCE-001 Fáze F §9/§18) - stejný vzor jako `ToolProfileSnapshot`. */
export class InspectionEquipmentProfileSnapshot extends ProfileSnapshot {
  static forInspectionEquipmentProfile(resolved: InspectionEquipmentProfile, options: { systemVersion: number; createdAt: string }): InspectionEquipmentProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId,
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: options.systemVersion,
      createdAt: options.createdAt,
    });
    return new InspectionEquipmentProfileSnapshot(base.toJSON());
  }
}
