import { ProfileSnapshot } from "../shared/profile-snapshot";
import { ManualTimeStandard } from "./manual-time-standard";

/** Immutable snapshot VYBRANÉHO `ManualTimeStandard` v okamžiku výpočtu
 *  (AP-MCE-001 Fáze F §5/§18 "persistuj použité časové standardy") - stejný
 *  vzor jako `ToolProfileSnapshot`/`MaterialProfileSnapshot` (Fáze B),
 *  `resolvedData` je plochý výstup `ManualTimeStandard.toPlainObject()`. */
export class ManualTimeProfileSnapshot extends ProfileSnapshot {
  static forManualTimeStandard(resolved: ManualTimeStandard, options: { createdAt: string }): ManualTimeProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId ?? "system",
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: resolved.recordVersion,
      createdAt: options.createdAt,
    });
    return new ManualTimeProfileSnapshot(base.toJSON());
  }
}
