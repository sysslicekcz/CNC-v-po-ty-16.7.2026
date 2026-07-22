import { ProfileSnapshot } from "../shared/profile-snapshot";
import { CalibrationProfile } from "./calibration-profile";

/** Immutable snapshot `CalibrationProfile` v okamžiku výpočtu (AP-MCE-001
 *  Fáze G §13/§18 "calibrationVersion je uložená ve snapshotu") - stejný
 *  vzor jako `ManualTimeProfileSnapshot`/`InspectionEquipmentProfileSnapshot`
 *  (Fáze F). Uloží se do `CalculationResult` (jako další volitelné pole,
 *  stejně jako `materialProfileSnapshot`) - i když se `CalibrationProfile`
 *  později supersedne, starý `CalculationResult` dál ukazuje na PŘESNOU
 *  verzi, kterou skutečně použil. */
export class CalibrationProfileSnapshot extends ProfileSnapshot {
  static forCalibrationProfile(resolved: CalibrationProfile, options: { createdAt: string }): CalibrationProfileSnapshot {
    const base = ProfileSnapshot.capture({
      profileId: resolved.id,
      tenantId: resolved.tenantId,
      siteId: resolved.siteId,
      resolvedData: resolved.toPlainObject(),
      systemVersion: resolved.recordVersion,
      createdAt: options.createdAt,
    });
    return new CalibrationProfileSnapshot(base.toJSON());
  }
}
