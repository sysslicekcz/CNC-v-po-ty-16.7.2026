import { ProfileSnapshot } from "../shared/profile-snapshot";
import { MaterialProfile } from "./material-profile";

/**
 * Immutable snapshot `MaterialProfile` v okamžiku výpočtu (AP-MCE-001 Fáze B
 * §10) - `CalculationResult` ho ukládá vedle sebe s `machineProfileSnapshot`/
 * `toolProfileSnapshot`, aby pozdější změna materiálu (přejmenování,
 * přepočítaný koeficient, nová korekce) NIKDY nezměnila historický výsledek.
 */
export class MaterialProfileSnapshot extends ProfileSnapshot {
  /** `resolved` musí být VÝSLEDEK `resolveMaterialProfileOverlay(...)`, ne
   *  syrový systémový profil. */
  static forMaterialProfile(
    resolved: MaterialProfile,
    options: { systemVersion: number; correctionVersion?: number; createdAt: string }
  ): MaterialProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId,
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: options.systemVersion,
      correctionVersion: options.correctionVersion,
      createdAt: options.createdAt,
    });
    return new MaterialProfileSnapshot(base.toJSON());
  }
}
