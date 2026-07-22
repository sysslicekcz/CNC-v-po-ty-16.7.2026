import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import type { ActualTimeSourceType, ActualTimeMeasurementMethod, ActualTimeStatus } from "./actual-time-enums";

/** Pole, která se čtou/validují jako minuty a NESMÍ být záporná, pokud jsou
 *  vyplněná - jedno místo se seznamem, ať `assertNonNegativeMinutes` neopisuje
 *  jméno pole na dvou místech (validace + iterace). */
const OPTIONAL_MINUTE_FIELDS = [
  "totalElapsedTimeMin",
  "setupTimeMin",
  "machineTimeMin",
  "operatorTimeMin",
  "handlingTimeMin",
  "inspectionTimeMin",
  "waitingTimeMin",
  "downtimeMin",
  "reworkTimeMin",
  "toolChangeTimeMin",
  "fixtureChangeTimeMin",
  "interruptionTimeMin",
  "goodPieceTimeMin",
] as const;

export interface ActualTimeRecordProps {
  id: string;
  tenantId: string;
  siteId?: string;
  calculationId?: string;
  calculationRevision?: number;
  productionOrderId?: string;
  operationId?: string;
  operationSequence?: number;
  externalReferences: readonly ExternalReferenceSummary[];
  operationCategory: OperationCategory;
  operationSubtype?: string;
  machineId?: string;
  workstationId?: string;
  employeeId?: string;
  shiftId?: string;
  quantityPlanned: number;
  quantityCompleted: number;
  quantityScrapped: number;
  setupStartedAt?: string;
  setupFinishedAt?: string;
  productionStartedAt?: string;
  productionFinishedAt?: string;
  totalElapsedTimeMin?: number;
  setupTimeMin?: number;
  machineTimeMin?: number;
  operatorTimeMin?: number;
  handlingTimeMin?: number;
  inspectionTimeMin?: number;
  waitingTimeMin?: number;
  downtimeMin?: number;
  reworkTimeMin?: number;
  toolChangeTimeMin?: number;
  fixtureChangeTimeMin?: number;
  interruptionTimeMin?: number;
  goodPieceTimeMin?: number;
  sourceType: ActualTimeSourceType;
  sourceSystem: string;
  sourceRecordId?: string;
  measurementMethod: ActualTimeMeasurementMethod;
  confidence: number;
  status: ActualTimeStatus;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * `ActualTimeRecord` (AP-MCE-001 Fáze G §2) - jeden skutečný výrobní záznam
 * (ruční zadání, import z ERP/MES, strojní signál, ...), tenant-scoped,
 * immutable po vytvoření (stejná disciplína jako `MaterialProfile`/
 * `ManualTimeStandard`). `externalReferences` je pole `ExternalReferenceSummary`
 * (Fáze B vzor) - ŽÁDNÉ pole typu `heliosId`/`sapId` (§5 "ERP-neutral").
 *
 * NEODKAZUJE na `CalculationResult` napevno (`calculationId`/`calculationRevision`
 * jsou nepovinné) - spárování dělá až `ActualTimeCalculationMatcher` (§6),
 * záznam může existovat i BEZ spárování (import předchází matchingu).
 */
export class ActualTimeRecord {
  private readonly props: Readonly<ActualTimeRecordProps>;

  private constructor(props: ActualTimeRecordProps) {
    this.props = Object.freeze({ ...props, externalReferences: Object.freeze([...props.externalReferences]) });
  }

  static create(props: ActualTimeRecordProps): ActualTimeRecord {
    if (!props.id.trim()) throw new ValidationError("ActualTimeRecord: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ActualTimeRecord: 'tenantId' nesmí být prázdné.");
    if (!Number.isFinite(props.quantityPlanned) || props.quantityPlanned < 0) {
      throw new ValidationError(`ActualTimeRecord: 'quantityPlanned' nesmí být záporné, dostal jsem "${props.quantityPlanned}".`);
    }
    if (!Number.isInteger(props.quantityCompleted) || props.quantityCompleted < 0) {
      throw new ValidationError(`ActualTimeRecord: 'quantityCompleted' musí být nezáporné celé číslo, dostal jsem "${props.quantityCompleted}".`);
    }
    if (!Number.isInteger(props.quantityScrapped) || props.quantityScrapped < 0) {
      throw new ValidationError(`ActualTimeRecord: 'quantityScrapped' musí být nezáporné celé číslo, dostal jsem "${props.quantityScrapped}".`);
    }
    for (const field of OPTIONAL_MINUTE_FIELDS) {
      const value = props[field];
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new ValidationError(`ActualTimeRecord: '${field}' nesmí být záporné, dostal jsem "${value}".`);
      }
    }
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 1) {
      throw new ValidationError(`ActualTimeRecord: 'confidence' musí být v rozsahu 0..1, dostal jsem "${props.confidence}".`);
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("ActualTimeRecord: 'recordVersion' musí být kladné celé číslo.");
    }
    if (
      props.setupStartedAt &&
      props.setupFinishedAt &&
      props.setupStartedAt > props.setupFinishedAt
    ) {
      throw new ValidationError("ActualTimeRecord: 'setupStartedAt' nesmí být po 'setupFinishedAt'.");
    }
    if (
      props.productionStartedAt &&
      props.productionFinishedAt &&
      props.productionStartedAt > props.productionFinishedAt
    ) {
      throw new ValidationError("ActualTimeRecord: 'productionStartedAt' nesmí být po 'productionFinishedAt'.");
    }
    return new ActualTimeRecord(props);
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
  get calculationId(): string | undefined {
    return this.props.calculationId;
  }
  get calculationRevision(): number | undefined {
    return this.props.calculationRevision;
  }
  get productionOrderId(): string | undefined {
    return this.props.productionOrderId;
  }
  get operationId(): string | undefined {
    return this.props.operationId;
  }
  get operationSequence(): number | undefined {
    return this.props.operationSequence;
  }
  get externalReferences(): readonly ExternalReferenceSummary[] {
    return this.props.externalReferences;
  }
  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get machineId(): string | undefined {
    return this.props.machineId;
  }
  get workstationId(): string | undefined {
    return this.props.workstationId;
  }
  get employeeId(): string | undefined {
    return this.props.employeeId;
  }
  get shiftId(): string | undefined {
    return this.props.shiftId;
  }
  get quantityPlanned(): number {
    return this.props.quantityPlanned;
  }
  get quantityCompleted(): number {
    return this.props.quantityCompleted;
  }
  get quantityScrapped(): number {
    return this.props.quantityScrapped;
  }
  get setupStartedAt(): string | undefined {
    return this.props.setupStartedAt;
  }
  get setupFinishedAt(): string | undefined {
    return this.props.setupFinishedAt;
  }
  get productionStartedAt(): string | undefined {
    return this.props.productionStartedAt;
  }
  get productionFinishedAt(): string | undefined {
    return this.props.productionFinishedAt;
  }
  get totalElapsedTimeMin(): number | undefined {
    return this.props.totalElapsedTimeMin;
  }
  get setupTimeMin(): number | undefined {
    return this.props.setupTimeMin;
  }
  get machineTimeMin(): number | undefined {
    return this.props.machineTimeMin;
  }
  get operatorTimeMin(): number | undefined {
    return this.props.operatorTimeMin;
  }
  get handlingTimeMin(): number | undefined {
    return this.props.handlingTimeMin;
  }
  get inspectionTimeMin(): number | undefined {
    return this.props.inspectionTimeMin;
  }
  get waitingTimeMin(): number | undefined {
    return this.props.waitingTimeMin;
  }
  get downtimeMin(): number | undefined {
    return this.props.downtimeMin;
  }
  get reworkTimeMin(): number | undefined {
    return this.props.reworkTimeMin;
  }
  get toolChangeTimeMin(): number | undefined {
    return this.props.toolChangeTimeMin;
  }
  get fixtureChangeTimeMin(): number | undefined {
    return this.props.fixtureChangeTimeMin;
  }
  get interruptionTimeMin(): number | undefined {
    return this.props.interruptionTimeMin;
  }
  get goodPieceTimeMin(): number | undefined {
    return this.props.goodPieceTimeMin;
  }
  get sourceType(): ActualTimeSourceType {
    return this.props.sourceType;
  }
  get sourceSystem(): string {
    return this.props.sourceSystem;
  }
  get sourceRecordId(): string | undefined {
    return this.props.sourceRecordId;
  }
  get measurementMethod(): ActualTimeMeasurementMethod {
    return this.props.measurementMethod;
  }
  get confidence(): number {
    return this.props.confidence;
  }
  get status(): ActualTimeStatus {
    return this.props.status;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get recordedBy(): string {
    return this.props.recordedBy;
  }
  get recordedAt(): string {
    return this.props.recordedAt;
  }
  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }
  get approvedAt(): string | undefined {
    return this.props.approvedAt;
  }
  get recordVersion(): number {
    return this.props.recordVersion;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }
  get archivedAt(): string | undefined {
    return this.props.archivedAt;
  }
  get isArchived(): boolean {
    return this.props.archivedAt !== undefined;
  }
  get isApproved(): boolean {
    return this.props.status === "approved";
  }

  /** Nová verze se schválením (§21 "approval") - vrací NOVOU instanci, stará
   *  se nikdy nemutuje (stejná disciplína jako `CalculationResult.asSuperseded`). */
  withApproval(approvedBy: string, approvedAt: string): ActualTimeRecord {
    return new ActualTimeRecord({ ...this.props, status: "approved", approvedBy, approvedAt, updatedAt: approvedAt, recordVersion: this.props.recordVersion + 1 });
  }

  withStatus(status: ActualTimeStatus, updatedAt: string): ActualTimeRecord {
    return new ActualTimeRecord({ ...this.props, status, updatedAt, recordVersion: this.props.recordVersion + 1 });
  }

  withMatch(calculationId: string, calculationRevision: number, updatedAt: string): ActualTimeRecord {
    return new ActualTimeRecord({ ...this.props, calculationId, calculationRevision, updatedAt, recordVersion: this.props.recordVersion + 1 });
  }

  archive(archivedAt: string): ActualTimeRecord {
    if (this.props.archivedAt) return this;
    return new ActualTimeRecord({ ...this.props, status: "archived", archivedAt, updatedAt: archivedAt, recordVersion: this.props.recordVersion + 1 });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, externalReferences: [...this.props.externalReferences] };
  }
}
