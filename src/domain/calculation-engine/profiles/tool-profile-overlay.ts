import { ToolProfile } from "./tool-profile";
import { ToolCorrection } from "./tool-correction";

/** Overlay model pro nástroje (AP-MCE-001 Fáze B §4): `System ToolProfile +
 *  Tenant ToolCorrection = Resolved ToolProfile` - stejný princip jako
 *  `resolveMaterialProfileOverlay`/`resolveMachineProfileOverlay`. */
export function resolveToolProfileOverlay(system: ToolProfile, correction?: ToolCorrection): ToolProfile {
  if (!correction || correction.isArchived) return system;
  if (correction.toolProfileId !== system.id) {
    throw new Error(`ToolCorrection "${correction.id}" patří profilu "${correction.toolProfileId}", ne "${system.id}".`);
  }

  return ToolProfile.create({
    id: system.id,
    tenantId: system.tenantId,
    siteId: system.siteId,
    externalReferences: system.externalReferences,
    manufacturer: system.manufacturer,
    toolTypeId: system.toolTypeId,
    toolTypeName: system.toolTypeName,
    catalogDesignation: system.catalogDesignation,
    toolMaterial: system.toolMaterial,
    geometry: system.geometry,
    diameterMm: system.diameterMm,
    lengthMm: system.lengthMm,
    usableLengthMm: system.usableLengthMm,
    teethCount: system.teethCount,
    cornerRadiusMm: system.cornerRadiusMm,
    insertType: system.insertType,
    suitableMaterialGroupIds: system.suitableMaterialGroupIds,
    supportedOperationCategories: system.supportedOperationCategories,
    defaultCuttingParameters: correction.defaultCuttingParameters ?? system.defaultCuttingParameters,
    toolLife: correction.toolLife ?? system.toolLife,
    toolChangeTimeSec: correction.toolChangeTimeSec ?? system.toolChangeTimeSec,
    price: system.price,
    currency: system.currency,
    maxCuttingSpeedMMin: system.maxCuttingSpeedMMin,
    wearFactorCurve: correction.wearFactorCurve ?? system.wearFactorCurve,
    tenantCorrectionId: correction.id,
    recordVersion: system.recordVersion,
    createdAt: system.createdAt,
    updatedAt: correction.updatedAt,
    archivedAt: system.archivedAt,
  });
}
