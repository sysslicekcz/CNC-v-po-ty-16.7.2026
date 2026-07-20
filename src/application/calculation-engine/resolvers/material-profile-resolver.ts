import { MaterialProfileRepository } from "@/domain/calculation-engine/repositories/material-profile-repository";
import { MaterialProfile } from "@/domain/calculation-engine/profiles/material-profile";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { resolveMaterialProfileOverlay } from "@/domain/calculation-engine/profiles/material-profile-overlay";
import { MaterialProfileSnapshot } from "@/domain/calculation-engine/profiles/material-profile-snapshot";
import { MaterialProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";

export interface ResolvedMaterialProfile {
  resolved: MaterialProfile;
  system: MaterialProfile;
  correction?: MaterialCorrection;
}

/**
 * `MaterialProfileResolver` (AP-MCE-001 Fáze B §6) - Application-vrstvá
 * služba, KTERÁ SMÍ volat repozitář (na rozdíl od `resolveMaterialProfile
 * Overlay`, což je čistá Domain funkce beze I/O). Tenhle resolver je jediné
 * místo, které obě věci (načtení + složení) spojuje - `CalculationContext
 * Resolver` i budoucí `ResolveMaterialProfileUseCase` ho volají místo toho,
 * aby si repozitář+overlay volaly samy a duplikovaly stejnou logiku.
 */
export class MaterialProfileResolver {
  constructor(private readonly repository: MaterialProfileRepository) {}

  async resolve(materialProfileId: string, tenantId: string): Promise<ResolvedMaterialProfile> {
    const system = await this.repository.getById(materialProfileId, tenantId);
    if (!system) throw new MaterialProfileNotFoundError(materialProfileId, tenantId);

    const correction = await this.repository.findCorrectionByProfileId(materialProfileId, tenantId);
    const resolved = resolveMaterialProfileOverlay(system, correction ?? undefined);
    return { resolved, system, correction: correction ?? undefined };
  }

  async resolveSnapshot(materialProfileId: string, tenantId: string, createdAt: string): Promise<MaterialProfileSnapshot> {
    const { resolved, system, correction } = await this.resolve(materialProfileId, tenantId);
    return MaterialProfileSnapshot.forMaterialProfile(resolved, {
      systemVersion: system.recordVersion,
      correctionVersion: correction?.recordVersion,
      createdAt,
    });
  }
}
