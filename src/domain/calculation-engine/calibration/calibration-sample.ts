import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/** AP-MCE-001 Fáze G §11 - přesné důvody vyřazení vzorku z kalibrace. */
export type CalibrationSampleExclusionReason =
  | "low_match_confidence"
  | "actual_time_not_approved"
  | "incomplete_data"
  | "unexplained_critical_downtime"
  | "zero_quantity"
  | "unmarked_rework"
  | "low_result_confidence"
  | "operation_changed"
  /** §12 - vzorek překročil EXPLICITNÍ tenant limit v `CalibrationOutlier
   *  Detector` (`OutlierStatus === "excluded"`) - na rozdíl od
   *  `"suspected"` (jen flag pro ruční revizi, NEVYŘAZUJE se automaticky). */
  | "statistical_outlier";

export interface CalibrationSampleEligibilityInput {
  matchConfidence: number;
  actualTimeApproved: boolean;
  hasCompleteData: boolean;
  hasCriticalUnexplainedDowntime: boolean;
  quantity: number;
  /** `true` pokud vzorek NENÍ rework, NEBO je rework a je jako takový
   *  správně označený (§11 "obsahují ... rework bez správného označení"). */
  isReworkProperlyMarked: boolean;
  resultConfidenceScore: number;
  operationChangedVsCalculatedProcedure: boolean;
}

export interface CalibrationSampleEligibilityResult {
  included: boolean;
  exclusionReason?: CalibrationSampleExclusionReason;
}

/** Prahy pro automatické vyřazení (§11) - zdokumentované MVP konstanty,
 *  stejná disciplína jako `SYSTEM_DEFAULT_*` konstanty jinde v modulu. */
const MIN_MATCH_CONFIDENCE_FOR_CALIBRATION = 0.7;
const MIN_RESULT_CONFIDENCE_FOR_CALIBRATION = 0.5;

/**
 * `evaluateCalibrationSampleEligibility` (AP-MCE-001 Fáze G §11) - ČISTÁ
 * funkce, PŘESNĚ osm podmínek ze zadání, v daném pořadí (první, která
 * selže, určuje `exclusionReason`) - vzorek NIKDY není automaticky použit,
 * pokud selže byť jen jedna.
 */
export function evaluateCalibrationSampleEligibility(input: CalibrationSampleEligibilityInput): CalibrationSampleEligibilityResult {
  if (input.matchConfidence < MIN_MATCH_CONFIDENCE_FOR_CALIBRATION) return { included: false, exclusionReason: "low_match_confidence" };
  if (!input.actualTimeApproved) return { included: false, exclusionReason: "actual_time_not_approved" };
  if (!input.hasCompleteData) return { included: false, exclusionReason: "incomplete_data" };
  if (input.hasCriticalUnexplainedDowntime) return { included: false, exclusionReason: "unexplained_critical_downtime" };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { included: false, exclusionReason: "zero_quantity" };
  if (!input.isReworkProperlyMarked) return { included: false, exclusionReason: "unmarked_rework" };
  if (input.resultConfidenceScore < MIN_RESULT_CONFIDENCE_FOR_CALIBRATION) return { included: false, exclusionReason: "low_result_confidence" };
  if (input.operationChangedVsCalculatedProcedure) return { included: false, exclusionReason: "operation_changed" };
  return { included: true };
}

export interface CalibrationSampleProps {
  id: string;
  tenantId: string;
  siteId?: string;
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  machineProfileId?: string;
  materialProfileId?: string;
  toolProfileIds: readonly string[];
  workstationId?: string;
  predictedTimeMin: number;
  actualTimeMin: number;
  variancePercent: number;
  quantity: number;
  confidenceScore: number;
  included: boolean;
  exclusionReason?: CalibrationSampleExclusionReason;
  approvedForCalibration: boolean;
  rootCauseAssignments: readonly string[];
  sampleWeight: number;
  createdAt: string;
  approvedAt?: string;
}

/**
 * `CalibrationSample` (AP-MCE-001 Fáze G §11) - JEDEN pár predikce/skutečnost
 * připravený pro kalibrační metody (§15). `included`/`exclusionReason` se
 * dopočítají PŘED vytvořením přes `evaluateCalibrationSampleEligibility()` -
 * `create()` jen ověří vnitřní konzistenci (vyřazený vzorek MUSÍ mít důvod,
 * `approvedForCalibration` nikdy nesmí být `true` u vyřazeného vzorku).
 */
export class CalibrationSample {
  private readonly props: Readonly<CalibrationSampleProps>;

  private constructor(props: CalibrationSampleProps) {
    this.props = Object.freeze({ ...props, toolProfileIds: Object.freeze([...props.toolProfileIds]), rootCauseAssignments: Object.freeze([...props.rootCauseAssignments]) });
  }

  static create(props: CalibrationSampleProps): CalibrationSample {
    if (!props.id.trim()) throw new ValidationError("CalibrationSample: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalibrationSample: 'tenantId' nesmí být prázdné.");
    if (!props.included && !props.exclusionReason) {
      throw new ValidationError("CalibrationSample: vyřazený vzorek musí mít 'exclusionReason'.");
    }
    if (!props.included && props.approvedForCalibration) {
      throw new ValidationError("CalibrationSample: vyřazený vzorek nesmí mít 'approvedForCalibration' true.");
    }
    if (!Number.isFinite(props.sampleWeight) || props.sampleWeight < 0) {
      throw new ValidationError("CalibrationSample: 'sampleWeight' nesmí být záporné.");
    }
    if (!Number.isFinite(props.confidenceScore) || props.confidenceScore < 0 || props.confidenceScore > 1) {
      throw new ValidationError("CalibrationSample: 'confidenceScore' musí být v rozsahu 0..1.");
    }
    return new CalibrationSample(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get calculationId(): string {
    return this.props.calculationId;
  }
  get calculationRevision(): number {
    return this.props.calculationRevision;
  }
  get actualTimeRecordId(): string {
    return this.props.actualTimeRecordId;
  }
  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get machineProfileId(): string | undefined {
    return this.props.machineProfileId;
  }
  get materialProfileId(): string | undefined {
    return this.props.materialProfileId;
  }
  get toolProfileIds(): readonly string[] {
    return this.props.toolProfileIds;
  }
  get workstationId(): string | undefined {
    return this.props.workstationId;
  }
  get predictedTimeMin(): number {
    return this.props.predictedTimeMin;
  }
  get actualTimeMin(): number {
    return this.props.actualTimeMin;
  }
  get variancePercent(): number {
    return this.props.variancePercent;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get confidenceScore(): number {
    return this.props.confidenceScore;
  }
  get included(): boolean {
    return this.props.included;
  }
  get exclusionReason(): CalibrationSampleExclusionReason | undefined {
    return this.props.exclusionReason;
  }
  get approvedForCalibration(): boolean {
    return this.props.approvedForCalibration;
  }
  get rootCauseAssignments(): readonly string[] {
    return this.props.rootCauseAssignments;
  }
  get sampleWeight(): number {
    return this.props.sampleWeight;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get approvedAt(): string | undefined {
    return this.props.approvedAt;
  }

  withOutlierExclusion(reason: CalibrationSampleExclusionReason): CalibrationSample {
    return new CalibrationSample({ ...this.props, included: false, exclusionReason: reason, approvedForCalibration: false });
  }

  withManualInclusion(approvedAt: string): CalibrationSample {
    return new CalibrationSample({ ...this.props, included: true, exclusionReason: undefined, approvedForCalibration: true, approvedAt });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, toolProfileIds: [...this.props.toolProfileIds], rootCauseAssignments: [...this.props.rootCauseAssignments] };
  }
}
