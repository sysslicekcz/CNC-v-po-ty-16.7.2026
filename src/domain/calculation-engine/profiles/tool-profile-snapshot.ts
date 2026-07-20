import { ProfileSnapshot } from "../shared/profile-snapshot";
import { ToolProfile } from "./tool-profile";

/** Immutable snapshot `ToolProfile` v okamžiku výpočtu (AP-MCE-001 Fáze B
 *  §10) - viz `MaterialProfileSnapshot` pro plné zdůvodnění vzoru. */
export class ToolProfileSnapshot extends ProfileSnapshot {
  static forToolProfile(
    resolved: ToolProfile,
    options: { systemVersion: number; correctionVersion?: number; createdAt: string }
  ): ToolProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId,
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: options.systemVersion,
      correctionVersion: options.correctionVersion,
      createdAt: options.createdAt,
    });
    return new ToolProfileSnapshot(base.toJSON());
  }
}
