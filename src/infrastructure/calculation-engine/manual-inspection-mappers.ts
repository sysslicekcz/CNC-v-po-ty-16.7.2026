import { ManualTimeStandard } from "@/domain/calculation-engine/manual/manual-time-standard";
import type { ManualOperationSubtype, ManualQuantityBasis } from "@/domain/calculation-engine/manual/manual-operation-subtype";
import type { ManualTimeStandardSource } from "@/domain/calculation-engine/manual/manual-time-standard";
import type { ComplexityLevel } from "@/domain/calculation-engine/manual/manual-operation-feature";
import { InspectionEquipmentProfile } from "@/domain/calculation-engine/inspection/inspection-equipment-profile";
import type { EquipmentType, AutomationLevel, ReportGenerationMode } from "@/domain/calculation-engine/inspection/inspection-equipment-profile";
import type { InspectionSubtype } from "@/domain/calculation-engine/inspection/inspection-subtype";
import { ManualTimeStandardRecord, InspectionEquipmentProfileRecord } from "@/infrastructure/persistence/indexeddb/records";

/**
 * Mapování Fáze F entit (ManualTimeStandard/InspectionEquipmentProfile) na/z
 * IndexedDB záznamů - stejná konvence jako `profile-mappers.ts` (Fáze B).
 */
export function manualTimeStandardToRecord(standard: ManualTimeStandard): ManualTimeStandardRecord {
  return standard.toPlainObject() as unknown as ManualTimeStandardRecord;
}

export function manualTimeStandardFromRecord(record: ManualTimeStandardRecord): ManualTimeStandard {
  return ManualTimeStandard.create({
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    operationSubtype: record.operationSubtype as ManualOperationSubtype,
    standardName: record.standardName,
    standardVersion: record.standardVersion,
    source: record.source as ManualTimeStandardSource,
    baseTimeMin: record.baseTimeMin,
    quantityBasis: record.quantityBasis as ManualQuantityBasis,
    complexityRange: record.complexityRange as { min: ComplexityLevel; max: ComplexityLevel } | undefined,
    validFrom: record.validFrom,
    validTo: record.validTo,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    archivedAt: record.archivedAt,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function inspectionEquipmentProfileToRecord(profile: InspectionEquipmentProfile): InspectionEquipmentProfileRecord {
  return profile.toPlainObject() as unknown as InspectionEquipmentProfileRecord;
}

export function inspectionEquipmentProfileFromRecord(record: InspectionEquipmentProfileRecord): InspectionEquipmentProfile {
  return InspectionEquipmentProfile.create({
    id: record.id,
    tenantId: record.tenantId,
    siteId: record.siteId,
    equipmentType: record.equipmentType as EquipmentType,
    manufacturer: record.manufacturer,
    model: record.model,
    serialNumber: record.serialNumber,
    supportedInspectionSubtypes: record.supportedInspectionSubtypes as InspectionSubtype[],
    accuracy: record.accuracy,
    measurementRange: record.measurementRange,
    setupTimeMin: record.setupTimeMin,
    calibrationValidTo: record.calibrationValidTo,
    equipmentCoefficient: record.equipmentCoefficient,
    automationLevel: record.automationLevel as AutomationLevel,
    reportGenerationMode: record.reportGenerationMode as ReportGenerationMode,
    recordVersion: record.recordVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
  });
}
