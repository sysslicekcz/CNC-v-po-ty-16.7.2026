import { MaterialProfile } from "./material-profile";
import { MaterialCorrection } from "./material-correction";

/**
 * Overlay model (AP-MCE-001 Fáze B §2):
 *
 *     System MaterialProfile + Tenant MaterialCorrection = Resolved MaterialProfile
 *
 * ČISTÁ funkce - žádné I/O, žádný přístup k repozitářům (stejná disciplína
 * jako existující `resolveCuttingConditions()` z Kroku 5). Kdo profil a
 * korekci NAČTE je věcí Application vrstvy (`MaterialProfileResolver` v
 * `application/calculation-engine/resolvers/`), tahle funkce jen definuje,
 * jak se dvě už načtené věci SLOŽÍ dohromady.
 *
 * `system` samotný se nikdy nemění (immutabilita `MaterialProfile`) - funkce
 * vrací VŽDY novou instanci. Bez korekce (`correction === undefined`) vrací
 * `system` beze změny (žádná zbytečná kopie).
 */
export function resolveMaterialProfileOverlay(system: MaterialProfile, correction?: MaterialCorrection): MaterialProfile {
  if (!correction || correction.isArchived) return system;
  if (correction.materialProfileId !== system.id) {
    throw new Error(
      `MaterialCorrection "${correction.id}" patří profilu "${correction.materialProfileId}", ne "${system.id}".`
    );
  }

  return MaterialProfile.create({
    id: system.id,
    tenantId: system.tenantId,
    siteId: system.siteId,
    sourceType: system.sourceType,
    name: system.name,
    standard: system.standard,
    designation: system.designation,
    materialGroupId: system.materialGroupId,
    materialGroupName: system.materialGroupName,
    hardness: system.hardness,
    hardnessScale: system.hardnessScale,
    tensileStrengthMpa: system.tensileStrengthMpa,
    densityKgM3: system.densityKgM3,
    machinabilityIndex: system.machinabilityIndex,
    materialCoefficient: correction.materialCoefficient ?? system.materialCoefficient,
    recommendedCuttingSpeeds: correction.recommendedCuttingSpeeds ?? system.recommendedCuttingSpeeds,
    recommendedFeeds: correction.recommendedFeeds ?? system.recommendedFeeds,
    suitableToolTypeIds: system.suitableToolTypeIds,
    notes: correction.notes ?? system.notes,
    dataSource: system.dataSource,
    externalReferences: system.externalReferences,
    recordVersion: system.recordVersion,
    createdAt: system.createdAt,
    updatedAt: correction.updatedAt,
    archivedAt: system.archivedAt,
  });
}
