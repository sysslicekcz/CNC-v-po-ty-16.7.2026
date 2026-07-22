import { ActualTimeRecord } from "@/domain/calculation-engine/calibration/actual-time-record";
import { ActualTimeSegment } from "@/domain/calculation-engine/calibration/actual-time-segment";
import { ActualTimeImportBatch, ActualTimeImportMapping } from "@/domain/calculation-engine/calibration/actual-time-import";
import { VarianceToleranceProfile } from "@/domain/calculation-engine/calibration/variance-tolerance-profile";
import { CalculationVarianceAnalysis } from "@/domain/calculation-engine/calibration/calculation-variance";
import { VarianceCauseAssignment } from "@/domain/calculation-engine/calibration/variance-cause";
import { CalibrationSample } from "@/domain/calculation-engine/calibration/calibration-sample";
import { CalibrationProfile } from "@/domain/calculation-engine/calibration/calibration-profile";
import { CalibrationProposal } from "@/domain/calculation-engine/calibration/calibration-proposal";
import { ShadowCalculationResult } from "@/domain/calculation-engine/calibration/shadow-mode";
import {
  ActualTimeRecordRecord,
  ActualTimeSegmentRecord,
  ActualTimeImportBatchRecord,
  ActualTimeImportMappingRecord,
  VarianceToleranceProfileRecord,
  CalculationVarianceRecord,
  VarianceCauseAssignmentRecord,
  CalibrationSampleRecord,
  CalibrationProfileRecord,
  CalibrationProposalRecord,
  ShadowCalculationResultRecord,
} from "@/infrastructure/persistence/indexeddb/records";

/**
 * Mapování doména <-> IndexedDB záznam pro celou Fázi G (AP-MCE-001 §24) -
 * stejný vzor jako `manual-inspection-mappers.ts` (Fáze F). Všechny entity
 * tady mají `toPlainObject()` tvar TOTOŽNÝ s konstruktorovými `Props` (žádné
 * vnořené hodnotové objekty), mapper je proto čistý průchod přes `create()`/
 * `toPlainObject()` - jediné místo, které ví, že tenhle vztah plyne z toho,
 * jak jsou entity navržené (kdyby některá později dostala vnořenou hodnotovou
 * třídu, změní se JEN mapper, entita/repozitář beze změny).
 */

export const actualTimeRecordToRecord = (entity: ActualTimeRecord): ActualTimeRecordRecord => entity.toPlainObject() as unknown as ActualTimeRecordRecord;
export const actualTimeRecordFromRecord = (record: ActualTimeRecordRecord): ActualTimeRecord => ActualTimeRecord.create(record);

export const actualTimeSegmentToRecord = (entity: ActualTimeSegment): ActualTimeSegmentRecord => entity.toPlainObject() as unknown as ActualTimeSegmentRecord;
export const actualTimeSegmentFromRecord = (record: ActualTimeSegmentRecord): ActualTimeSegment => ActualTimeSegment.create(record);

export const actualTimeImportBatchToRecord = (entity: ActualTimeImportBatch): ActualTimeImportBatchRecord => entity.toPlainObject() as unknown as ActualTimeImportBatchRecord;
export const actualTimeImportBatchFromRecord = (record: ActualTimeImportBatchRecord): ActualTimeImportBatch => ActualTimeImportBatch.create(record);

export const actualTimeImportMappingToRecord = (entity: ActualTimeImportMapping): ActualTimeImportMappingRecord => entity.toPlainObject() as unknown as ActualTimeImportMappingRecord;
export const actualTimeImportMappingFromRecord = (record: ActualTimeImportMappingRecord): ActualTimeImportMapping => ActualTimeImportMapping.create(record);

export const varianceToleranceProfileToRecord = (entity: VarianceToleranceProfile): VarianceToleranceProfileRecord => entity.toPlainObject() as unknown as VarianceToleranceProfileRecord;
export const varianceToleranceProfileFromRecord = (record: VarianceToleranceProfileRecord): VarianceToleranceProfile => VarianceToleranceProfile.create(record);

export function calculationVarianceToRecord(analysis: CalculationVarianceAnalysis, tenantId: string): CalculationVarianceRecord {
  return { ...analysis, id: `${analysis.calculationId}:${analysis.calculationRevision}`, tenantId };
}
export function calculationVarianceFromRecord(record: CalculationVarianceRecord): CalculationVarianceAnalysis {
  const { calculationId, calculationRevision, actualTimeRecordId, metrics, analyzedAt } = record;
  return { calculationId, calculationRevision, actualTimeRecordId, metrics, analyzedAt };
}

export const varianceCauseAssignmentToRecord = (entity: VarianceCauseAssignment): VarianceCauseAssignmentRecord => entity.toPlainObject() as unknown as VarianceCauseAssignmentRecord;
export const varianceCauseAssignmentFromRecord = (record: VarianceCauseAssignmentRecord): VarianceCauseAssignment => VarianceCauseAssignment.create(record);

export const calibrationSampleToRecord = (entity: CalibrationSample): CalibrationSampleRecord => entity.toPlainObject() as unknown as CalibrationSampleRecord;
export const calibrationSampleFromRecord = (record: CalibrationSampleRecord): CalibrationSample => CalibrationSample.create(record);

export const calibrationProfileToRecord = (entity: CalibrationProfile): CalibrationProfileRecord => entity.toPlainObject() as unknown as CalibrationProfileRecord;
export const calibrationProfileFromRecord = (record: CalibrationProfileRecord): CalibrationProfile => CalibrationProfile.create(record);

export const calibrationProposalToRecord = (entity: CalibrationProposal): CalibrationProposalRecord => entity.toPlainObject() as unknown as CalibrationProposalRecord;
export const calibrationProposalFromRecord = (record: CalibrationProposalRecord): CalibrationProposal => CalibrationProposal.create(record);

export const shadowCalculationResultToRecord = (entity: ShadowCalculationResult): ShadowCalculationResultRecord => entity.toPlainObject() as unknown as ShadowCalculationResultRecord;
export const shadowCalculationResultFromRecord = (record: ShadowCalculationResultRecord): ShadowCalculationResult => ShadowCalculationResult.create(record);
