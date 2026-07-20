import { ProfileSnapshot } from "../shared/profile-snapshot";
import { MachineProfile } from "./machine-profile";

/** Immutable snapshot `MachineProfile` v okamžiku výpočtu (AP-MCE-001 Fáze B
 *  §10) - viz `MaterialProfileSnapshot` pro plné zdůvodnění vzoru. */
export class MachineProfileSnapshot extends ProfileSnapshot {
  static forMachineProfile(
    resolved: MachineProfile,
    options: { systemVersion: number; correctionVersion?: number; createdAt: string }
  ): MachineProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId,
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: options.systemVersion,
      correctionVersion: options.correctionVersion,
      createdAt: options.createdAt,
    });
    return new MachineProfileSnapshot(base.toJSON());
  }
}
