import { MachineProfile } from "./machine-profile";
import { MachineCorrection } from "./machine-correction";

/**
 * Overlay model pro stroje (AP-MCE-001 Fáze B §3): `System MachineProfile +
 * Tenant MachineCorrection = Resolved MachineProfile`, stejný princip jako
 * `resolveMaterialProfileOverlay` - čistá funkce, žádné I/O.
 *
 * `recordVersion` resolved profilu zůstává SHODNÝ se systémovým (overlay je
 * jen dočasný spočtený pohled pro účely výpočtu, ne nová persistovaná verze -
 * tu drží samostatně `MachineCorrection.recordVersion`, a snapshoty obojí
 * nesou zvlášť v `systemVersion`/`correctionVersion`, viz `ProfileSnapshot`).
 */
export function resolveMachineProfileOverlay(system: MachineProfile, correction?: MachineCorrection): MachineProfile {
  if (!correction || correction.isArchived) return system;
  if (correction.machineProfileId !== system.id) {
    throw new Error(`MachineCorrection "${correction.id}" patří profilu "${correction.machineProfileId}", ne "${system.id}".`);
  }

  return MachineProfile.create({
    id: system.id,
    tenantId: system.tenantId,
    siteId: system.siteId,
    externalReferences: system.externalReferences,
    manufacturer: system.manufacturer,
    model: system.model,
    serialNumber: system.serialNumber,
    machineCategory: system.machineCategory,
    controlSystem: system.controlSystem,
    logicalWorkstationId: system.logicalWorkstationId,
    physicalMachineId: system.physicalMachineId,
    maxRpm: system.maxRpm,
    minRpm: system.minRpm,
    maxPowerKw: system.maxPowerKw,
    maxTorqueNm: system.maxTorqueNm,
    workEnvelope: system.workEnvelope,
    maxPartDimensions: system.maxPartDimensions,
    maxPartWeightKg: system.maxPartWeightKg,
    axisCount: system.axisCount,
    toolMagazineCapacity: system.toolMagazineCapacity,
    toolChangeTimeSec: system.toolChangeTimeSec,
    rapidTraverseRateMmMin: system.rapidTraverseRateMmMin,
    accelerationMmSec2: system.accelerationMmSec2,
    positioningAccuracyMm: system.positioningAccuracyMm,
    availableFunctions: system.availableFunctions,
    powerCoefficient: correction.powerCoefficient ?? system.powerCoefficient,
    ageCoefficient: correction.ageCoefficient ?? system.ageCoefficient,
    conditionCoefficient: correction.conditionCoefficient ?? system.conditionCoefficient,
    typicalSetupTimes: correction.typicalSetupTimes ?? system.typicalSetupTimes,
    tenantCorrectionId: correction.id,
    calibrationProfileId: system.calibrationProfileId,
    recordVersion: system.recordVersion,
    createdAt: system.createdAt,
    updatedAt: correction.updatedAt,
    archivedAt: system.archivedAt,
  });
}
