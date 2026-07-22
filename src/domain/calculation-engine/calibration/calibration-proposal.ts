import { ValidationError } from "@/domain/errors/validation-error";
import { CalibrationProfileScope } from "./calibration-profile";
import { CalibrationCoefficientTargetName } from "./coefficient-target";

export type CalibrationProposalStatus = "draft" | "generated" | "validated" | "under_review" | "approved" | "rejected" | "applied" | "expired";

export interface CalibrationPredictedImpact {
  sampleCount: number;
  periodFrom: string;
  periodTo: string;
  variance: number;
  median: number;
  mean: number;
  outlierCount: number;
  estimatedErrorReductionPercent: number;
  risks: readonly string[];
}

export interface CalibrationProposalValidationResult {
  backtestId: string;
  passed: boolean;
  maeBeforeMin: number;
  maeAfterMin: number;
}

export interface CalibrationProposalProps {
  id: string;
  tenantId: string;
  siteId?: string;
  profileScope: CalibrationProfileScope;
  sourceSampleIds: readonly string[];
  excludedSampleIds: readonly string[];
  currentCoefficients: Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>>;
  proposedCoefficients: Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>>;
  predictedImpact: CalibrationPredictedImpact;
  validationResult?: CalibrationProposalValidationResult;
  confidence: number;
  status: CalibrationProposalStatus;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  proposalVersion: number;
}

export interface CoefficientDiff {
  name: CalibrationCoefficientTargetName;
  currentValue: number;
  proposedValue: number;
  changePercent: number;
}

/**
 * `CalibrationProposal` (AP-MCE-001 Fáze G §16) - JEDEN návrh kalibrace mezi
 * vygenerováním (§15 `CalibrationMethod`) a aktivací (§13 `CalibrationProfile.
 * activate()`). Immutable po vytvoření - `review()`/`approve()`/`reject()`/
 * `apply()`/`expire()` vždy vrací NOVOU instanci, stejná disciplína jako
 * zbytek modulu.
 */
export class CalibrationProposal {
  private readonly props: Readonly<CalibrationProposalProps>;

  private constructor(props: CalibrationProposalProps) {
    this.props = Object.freeze({
      ...props,
      sourceSampleIds: Object.freeze([...props.sourceSampleIds]),
      excludedSampleIds: Object.freeze([...props.excludedSampleIds]),
      currentCoefficients: Object.freeze({ ...props.currentCoefficients }),
      proposedCoefficients: Object.freeze({ ...props.proposedCoefficients }),
      predictedImpact: Object.freeze({ ...props.predictedImpact, risks: Object.freeze([...props.predictedImpact.risks]) }),
    });
  }

  static create(props: CalibrationProposalProps): CalibrationProposal {
    if (!props.id.trim()) throw new ValidationError("CalibrationProposal: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalibrationProposal: 'tenantId' nesmí být prázdné.");
    if (props.sourceSampleIds.length === 0) throw new ValidationError("CalibrationProposal: 'sourceSampleIds' nesmí být prázdné.");
    if (!Number.isInteger(props.proposalVersion) || props.proposalVersion < 1) {
      throw new ValidationError("CalibrationProposal: 'proposalVersion' musí být kladné celé číslo.");
    }
    return new CalibrationProposal(props);
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
  get profileScope(): CalibrationProfileScope {
    return this.props.profileScope;
  }
  get sourceSampleIds(): readonly string[] {
    return this.props.sourceSampleIds;
  }
  get excludedSampleIds(): readonly string[] {
    return this.props.excludedSampleIds;
  }
  get currentCoefficients(): Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>> {
    return this.props.currentCoefficients;
  }
  get proposedCoefficients(): Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>> {
    return this.props.proposedCoefficients;
  }
  get predictedImpact(): Readonly<CalibrationPredictedImpact> {
    return this.props.predictedImpact;
  }
  get validationResult(): Readonly<CalibrationProposalValidationResult> | undefined {
    return this.props.validationResult;
  }
  get confidence(): number {
    return this.props.confidence;
  }
  get status(): CalibrationProposalStatus {
    return this.props.status;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get reviewedBy(): string | undefined {
    return this.props.reviewedBy;
  }
  get reviewedAt(): string | undefined {
    return this.props.reviewedAt;
  }
  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }
  get approvedAt(): string | undefined {
    return this.props.approvedAt;
  }
  get rejectionReason(): string | undefined {
    return this.props.rejectionReason;
  }
  get proposalVersion(): number {
    return this.props.proposalVersion;
  }

  /** §16 "rozdíl proti aktuálním koeficientům" - jedna položka pro KAŽDÝ
   *  koeficient, který se návrhem mění. */
  get coefficientDiffs(): CoefficientDiff[] {
    const names = new Set<CalibrationCoefficientTargetName>([
      ...(Object.keys(this.props.currentCoefficients) as CalibrationCoefficientTargetName[]),
      ...(Object.keys(this.props.proposedCoefficients) as CalibrationCoefficientTargetName[]),
    ]);
    return [...names].map((name) => {
      const currentValue = this.props.currentCoefficients[name] ?? 1;
      const proposedValue = this.props.proposedCoefficients[name] ?? currentValue;
      return { name, currentValue, proposedValue, changePercent: currentValue !== 0 ? ((proposedValue - currentValue) / currentValue) * 100 : 0 };
    });
  }

  withValidationResult(validationResult: CalibrationProposalValidationResult): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, validationResult, status: "validated" });
  }

  review(reviewedBy: string, reviewedAt: string): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, status: "under_review", reviewedBy, reviewedAt });
  }

  approve(approvedBy: string, approvedAt: string): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, status: "approved", approvedBy, approvedAt });
  }

  reject(rejectionReason: string, reviewedBy: string, reviewedAt: string): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, status: "rejected", rejectionReason, reviewedBy, reviewedAt });
  }

  apply(): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, status: "applied" });
  }

  expire(): CalibrationProposal {
    return new CalibrationProposal({ ...this.props, status: "expired" });
  }

  toPlainObject(): Record<string, unknown> {
    return {
      ...this.props,
      sourceSampleIds: [...this.props.sourceSampleIds],
      excludedSampleIds: [...this.props.excludedSampleIds],
      currentCoefficients: { ...this.props.currentCoefficients },
      proposedCoefficients: { ...this.props.proposedCoefficients },
      predictedImpact: { ...this.props.predictedImpact, risks: [...this.props.predictedImpact.risks] },
    };
  }
}
