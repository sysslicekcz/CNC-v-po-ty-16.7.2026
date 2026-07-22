import type { ActualTimeRecordProps } from "@/domain/calculation-engine/calibration/actual-time-record";
import type { ActualTimeSegmentProps } from "@/domain/calculation-engine/calibration/actual-time-segment";
import type { ActualTimeImportBatchProps, ActualTimeImportMappingProps } from "@/domain/calculation-engine/calibration/actual-time-import";
import type { VarianceToleranceProfileProps } from "@/domain/calculation-engine/calibration/variance-tolerance-profile";
import type { CalculationVarianceAnalysis } from "@/domain/calculation-engine/calibration/calculation-variance";
import type { VarianceCauseAssignmentProps } from "@/domain/calculation-engine/calibration/variance-cause";
import type { CalibrationSampleProps } from "@/domain/calculation-engine/calibration/calibration-sample";
import type { CalibrationProfileProps } from "@/domain/calculation-engine/calibration/calibration-profile";
import type { CalibrationProposalProps } from "@/domain/calculation-engine/calibration/calibration-proposal";
import type { ShadowCalculationResultProps } from "@/domain/calculation-engine/calibration/shadow-mode";

/**
 * Ploché IndexedDB záznamy pro Fázi G (AP-MCE-001 §24) - stejný vzor jako
 * `calculation-engine-manual-inspection-records.ts` (Fáze F). Všechny
 * doménové entity tady mají VLASTNOSTI přímo serializovatelné (žádné
 * vnořené hodnotové objekty s vlastním `toJSON()`/`fromJSON()` jako `Time`/
 * `Quantity`) - `Record` tvar je proto totožný s `...Props`, mapper (viz
 * `calibration-mappers.ts`) je jen `create()`/`toPlainObject()` průchod.
 */
export type ActualTimeRecordRecord = ActualTimeRecordProps;
export type ActualTimeSegmentRecord = ActualTimeSegmentProps;
export type ActualTimeImportBatchRecord = ActualTimeImportBatchProps;
export type ActualTimeImportMappingRecord = ActualTimeImportMappingProps;
export type VarianceToleranceProfileRecord = VarianceToleranceProfileProps;
export type CalculationVarianceRecord = CalculationVarianceAnalysis & { id: string; tenantId: string };
export type VarianceCauseAssignmentRecord = VarianceCauseAssignmentProps;
export type CalibrationSampleRecord = CalibrationSampleProps;
export type CalibrationProfileRecord = CalibrationProfileProps;
export type CalibrationProposalRecord = CalibrationProposalProps;
export type ShadowCalculationResultRecord = ShadowCalculationResultProps;
