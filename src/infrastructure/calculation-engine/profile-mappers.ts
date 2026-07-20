import { MaterialProfile, MaterialProfileSourceType } from "@/domain/calculation-engine/profiles/material-profile";
import { MaterialCorrection } from "@/domain/calculation-engine/profiles/material-correction";
import { MaterialCuttingRecommendation } from "@/domain/calculation-engine/profiles/material-cutting-recommendation";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import type { MachineCategory } from "@/domain/entities/machine";
import { MachineCorrection } from "@/domain/calculation-engine/profiles/machine-correction";
import { MachineWorkEnvelope } from "@/domain/calculation-engine/profiles/machine-work-envelope";
import { MachineSetupTimeProfile } from "@/domain/calculation-engine/profiles/machine-setup-time-profile";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolCorrection } from "@/domain/calculation-engine/profiles/tool-correction";
import { ToolLifeProfile } from "@/domain/calculation-engine/profiles/tool-life-profile";
import { ToolWearCurve } from "@/domain/calculation-engine/profiles/tool-wear-curve";
import { ToolCuttingParameters } from "@/domain/calculation-engine/profiles/tool-cutting-parameters";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { CuttingCondition, CuttingConditionSource } from "@/domain/calculation-engine/cutting-conditions/cutting-condition";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate, FeedRateUnit } from "@/domain/calculation-engine/value-objects/feed-rate";
import { Length } from "@/domain/calculation-engine/value-objects/length";
import { SpindleSpeed } from "@/domain/calculation-engine/value-objects/spindle-speed";
import {
  MaterialProfileRecord,
  MaterialCorrectionRecord,
  MachineProfileRecord,
  MachineCorrectionRecord,
  ToolProfileRecord,
  ToolCorrectionRecord,
  CuttingConditionRecord,
} from "@/infrastructure/persistence/indexeddb/records";

/**
 * Mapování Fáze B profilů/korekcí/řezných podmínek na/z IndexedDB záznamů -
 * stejná konvence jako `mappers.ts` (Fáze A), jen v samostatném souboru kvůli
 * rozsahu. `toRecord` využívá `XProfile.toPlainObject()` (navržený přesně pro
 * tenhle účel - viz komentář u metody), `fromRecord` vždy rekonstruuje přes
 * `XProfile.create(...)` se zpětně sestavenými hodnotovými objekty.
 */
export function materialProfileToRecord(profile: MaterialProfile): MaterialProfileRecord {
  return profile.toPlainObject() as unknown as MaterialProfileRecord;
}

export function materialProfileFromRecord(record: MaterialProfileRecord): MaterialProfile {
  return MaterialProfile.create({
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    sourceType: record.sourceType as MaterialProfileSourceType,
    name: record.name,
    standard: record.standard,
    designation: record.designation,
    materialGroupId: record.materialGroupId,
    materialGroupName: record.materialGroupName,
    hardness: record.hardness,
    hardnessScale: record.hardnessScale,
    tensileStrengthMpa: record.tensileStrengthMpa,
    densityKgM3: record.densityKgM3,
    machinabilityIndex: record.machinabilityIndex,
    materialCoefficient: record.materialCoefficient,
    recommendedCuttingSpeeds: record.recommendedCuttingSpeeds.map((r) => MaterialCuttingRecommendation.fromJSON(r)),
    recommendedFeeds: record.recommendedFeeds.map((r) => MaterialCuttingRecommendation.fromJSON(r)),
    suitableToolTypeIds: record.suitableToolTypeIds,
    notes: record.notes,
    dataSource: record.dataSource,
    externalReferences: record.externalReferences,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

export function materialCorrectionToRecord(correction: MaterialCorrection): MaterialCorrectionRecord {
  return correction.toPlainObject() as unknown as MaterialCorrectionRecord;
}

export function materialCorrectionFromRecord(record: MaterialCorrectionRecord): MaterialCorrection {
  return MaterialCorrection.create({
    id: record.id,
    tenantId: record.tenantId,
    materialProfileId: record.materialProfileId,
    materialCoefficient: record.materialCoefficient,
    recommendedCuttingSpeeds: record.recommendedCuttingSpeeds?.map((r) => MaterialCuttingRecommendation.fromJSON(r)),
    recommendedFeeds: record.recommendedFeeds?.map((r) => MaterialCuttingRecommendation.fromJSON(r)),
    notes: record.notes,
    reason: record.reason,
    createdBy: record.createdBy,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

export function machineProfileToRecord(profile: MachineProfile): MachineProfileRecord {
  return profile.toPlainObject() as unknown as MachineProfileRecord;
}

export function machineProfileFromRecord(record: MachineProfileRecord): MachineProfile {
  return MachineProfile.create({
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    externalReferences: record.externalReferences,
    manufacturer: record.manufacturer,
    model: record.model,
    serialNumber: record.serialNumber,
    machineCategory: record.machineCategory as MachineCategory | undefined,
    controlSystem: record.controlSystem,
    logicalWorkstationId: record.logicalWorkstationId,
    physicalMachineId: record.physicalMachineId,
    maxRpm: record.maxRpm,
    minRpm: record.minRpm,
    maxPowerKw: record.maxPowerKw,
    maxTorqueNm: record.maxTorqueNm,
    workEnvelope: record.workEnvelope ? MachineWorkEnvelope.fromJSON(record.workEnvelope) : undefined,
    maxPartDimensions: record.maxPartDimensions ? MachineWorkEnvelope.fromJSON(record.maxPartDimensions) : undefined,
    maxPartWeightKg: record.maxPartWeightKg,
    axisCount: record.axisCount,
    toolMagazineCapacity: record.toolMagazineCapacity,
    toolChangeTimeSec: record.toolChangeTimeSec,
    rapidTraverseRateMmMin: record.rapidTraverseRateMmMin,
    accelerationMmSec2: record.accelerationMmSec2,
    positioningAccuracyMm: record.positioningAccuracyMm,
    availableFunctions: record.availableFunctions,
    powerCoefficient: record.powerCoefficient,
    ageCoefficient: record.ageCoefficient,
    conditionCoefficient: record.conditionCoefficient,
    typicalSetupTimes: record.typicalSetupTimes.map((s) => MachineSetupTimeProfile.fromJSON(s)),
    tenantCorrectionId: record.tenantCorrectionId,
    calibrationProfileId: record.calibrationProfileId,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

export function machineCorrectionToRecord(correction: MachineCorrection): MachineCorrectionRecord {
  return correction.toPlainObject() as unknown as MachineCorrectionRecord;
}

export function machineCorrectionFromRecord(record: MachineCorrectionRecord): MachineCorrection {
  return MachineCorrection.create({
    id: record.id,
    tenantId: record.tenantId,
    machineProfileId: record.machineProfileId,
    powerCoefficient: record.powerCoefficient,
    ageCoefficient: record.ageCoefficient,
    conditionCoefficient: record.conditionCoefficient,
    typicalSetupTimes: record.typicalSetupTimes?.map((s) => MachineSetupTimeProfile.fromJSON(s)),
    reason: record.reason,
    createdBy: record.createdBy,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

export function toolProfileToRecord(profile: ToolProfile): ToolProfileRecord {
  return profile.toPlainObject() as unknown as ToolProfileRecord;
}

export function toolProfileFromRecord(record: ToolProfileRecord): ToolProfile {
  return ToolProfile.create({
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    externalReferences: record.externalReferences,
    manufacturer: record.manufacturer,
    toolTypeId: record.toolTypeId,
    toolTypeName: record.toolTypeName,
    catalogDesignation: record.catalogDesignation,
    toolMaterial: record.toolMaterial,
    geometry: record.geometry,
    diameterMm: record.diameterMm,
    lengthMm: record.lengthMm,
    usableLengthMm: record.usableLengthMm,
    teethCount: record.teethCount,
    cornerRadiusMm: record.cornerRadiusMm,
    insertType: record.insertType,
    suitableMaterialGroupIds: record.suitableMaterialGroupIds,
    supportedOperationCategories: record.supportedOperationCategories,
    defaultCuttingParameters: record.defaultCuttingParameters.map((p) => ToolCuttingParameters.fromJSON(p)),
    toolLife: ToolLifeProfile.fromJSON(record.toolLife),
    toolChangeTimeSec: record.toolChangeTimeSec,
    price: record.price,
    currency: record.currency,
    wearFactorCurve: ToolWearCurve.fromJSON(record.wearFactorCurve),
    tenantCorrectionId: record.tenantCorrectionId,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

export function toolCorrectionToRecord(correction: ToolCorrection): ToolCorrectionRecord {
  return correction.toPlainObject() as unknown as ToolCorrectionRecord;
}

export function toolCorrectionFromRecord(record: ToolCorrectionRecord): ToolCorrection {
  return ToolCorrection.create({
    id: record.id,
    tenantId: record.tenantId,
    toolProfileId: record.toolProfileId,
    toolLife: record.toolLife ? ToolLifeProfile.fromJSON(record.toolLife) : undefined,
    wearFactorCurve: record.wearFactorCurve ? ToolWearCurve.fromJSON(record.wearFactorCurve) : undefined,
    toolChangeTimeSec: record.toolChangeTimeSec,
    defaultCuttingParameters: record.defaultCuttingParameters?.map((p) => ToolCuttingParameters.fromJSON(p)),
    reason: record.reason,
    createdBy: record.createdBy,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}

const FEED_UNITS: readonly FeedRateUnit[] = ["mm_per_rev", "mm_per_tooth", "mm_per_min"];

function feedRateToRecord(feedRate?: FeedRate): { value: number; unit: string } | undefined {
  return feedRate ? feedRate.toJSON() : undefined;
}

function feedRateFromRecord(record?: { value: number; unit: string }): FeedRate | undefined {
  if (!record) return undefined;
  if (!FEED_UNITS.includes(record.unit as FeedRateUnit)) {
    throw new Error(`CuttingCondition: neznámá jednotka posuvu "${record.unit}".`);
  }
  return FeedRate.fromJSON({ value: record.value, unit: record.unit as FeedRateUnit });
}

export function cuttingConditionToRecord(condition: CuttingCondition): CuttingConditionRecord {
  return {
    id: condition.id,
    tenantId: condition.tenantId,
    materialProfileId: condition.materialProfileId,
    machineProfileId: condition.machineProfileId,
    toolProfileId: condition.toolProfileId,
    operationCategory: condition.operationCategory,
    operationSubtype: condition.operationSubtype,
    cuttingSpeed: condition.cuttingSpeed?.toJSON(),
    feedPerRevolution: feedRateToRecord(condition.feedPerRevolution),
    feedPerTooth: feedRateToRecord(condition.feedPerTooth),
    feedRate: feedRateToRecord(condition.feedRate),
    depthOfCut: condition.depthOfCut?.toJSON(),
    widthOfCut: condition.widthOfCut?.toJSON(),
    spindleSpeed: condition.spindleSpeed?.toJSON(),
    coolantMode: condition.coolantMode,
    source: condition.source,
    priority: condition.priority,
    confidence: condition.confidence,
    ruleVersion: condition.ruleVersion,
    validFrom: condition.validFrom,
    validTo: condition.validTo,
  };
}

export function cuttingConditionFromRecord(record: CuttingConditionRecord): CuttingCondition {
  return CuttingCondition.create({
    id: record.id,
    tenantId: record.tenantId,
    materialProfileId: record.materialProfileId,
    machineProfileId: record.machineProfileId,
    toolProfileId: record.toolProfileId,
    operationCategory: record.operationCategory as OperationCategory,
    operationSubtype: record.operationSubtype,
    cuttingSpeed: record.cuttingSpeed !== undefined ? CuttingSpeed.fromJSON(record.cuttingSpeed) : undefined,
    feedPerRevolution: feedRateFromRecord(record.feedPerRevolution),
    feedPerTooth: feedRateFromRecord(record.feedPerTooth),
    feedRate: feedRateFromRecord(record.feedRate),
    depthOfCut: record.depthOfCut !== undefined ? Length.fromJSON(record.depthOfCut) : undefined,
    widthOfCut: record.widthOfCut !== undefined ? Length.fromJSON(record.widthOfCut) : undefined,
    spindleSpeed: record.spindleSpeed !== undefined ? SpindleSpeed.fromJSON(record.spindleSpeed) : undefined,
    coolantMode: record.coolantMode,
    source: record.source as CuttingConditionSource,
    priority: record.priority,
    confidence: record.confidence,
    ruleVersion: record.ruleVersion,
    validFrom: record.validFrom,
    validTo: record.validTo,
  });
}
