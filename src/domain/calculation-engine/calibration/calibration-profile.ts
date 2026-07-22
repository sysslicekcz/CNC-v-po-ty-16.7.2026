import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";
import { CoefficientTarget, CalibrationCoefficientTargetName } from "./coefficient-target";

/** AP-MCE-001 Fáze G §13 - jedenáct podporovaných rozsahů platnosti profilu,
 *  od nejobecnějšího (`global`) po nejkonkrétnější (`machine_material_and_tool`). */
export type CalibrationProfileScope =
  | "global"
  | "tenant"
  | "site"
  | "operation_category"
  | "operation_subtype"
  | "machine"
  | "machine_and_material"
  | "machine_material_and_tool"
  | "workstation"
  | "manual_operation"
  | "inspection_method";

export type CalibrationProfileStatus = "draft" | "calculated" | "under_review" | "approved" | "active" | "rejected" | "superseded" | "archived";

export interface CalibrationProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  name: string;
  description?: string;
  scope: CalibrationProfileScope;
  operationCategory?: OperationCategory;
  operationSubtype?: string;
  machineProfileId?: string;
  materialGroupId?: string;
  toolTypeId?: string;
  workstationId?: string;
  coefficientTargets: readonly CoefficientTarget[];
  sampleCount: number;
  effectiveSampleCount: number;
  coefficientValues: Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>>;
  confidenceScore: number;
  status: CalibrationProfileStatus;
  calibrationMethod: string;
  validFrom: string;
  validTo?: string;
  approvedBy?: string;
  approvedAt?: string;
  recordVersion: number;
  parentVersionId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * `CalibrationProfile` (AP-MCE-001 Fáze G §13) - verzovaný, tenant-scoped
 * kalibrační profil. Immutable po vytvoření - `activate()`/`supersede()`/
 * `approve()` vždy vrací NOVOU instanci (§18 "ochrana proti retroaktivní
 * změně starých výsledků": aktivace NOVÉ verze nikdy nemutuje starou,
 * `CalculationResult`, které starou verzi použily, na ně dál ukazují přes
 * `calibrationVersion` ve snapshotu - viz `CalibrationProfileResolver`).
 */
export class CalibrationProfile {
  private readonly props: Readonly<CalibrationProfileProps>;

  private constructor(props: CalibrationProfileProps) {
    this.props = Object.freeze({ ...props, coefficientTargets: Object.freeze([...props.coefficientTargets]), coefficientValues: Object.freeze({ ...props.coefficientValues }) });
  }

  static create(props: CalibrationProfileProps): CalibrationProfile {
    if (!props.id.trim()) throw new ValidationError("CalibrationProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalibrationProfile: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("CalibrationProfile: 'name' nesmí být prázdné.");
    if (!Number.isInteger(props.sampleCount) || props.sampleCount < 0) {
      throw new ValidationError("CalibrationProfile: 'sampleCount' musí být nezáporné celé číslo.");
    }
    if (!Number.isFinite(props.effectiveSampleCount) || props.effectiveSampleCount < 0) {
      throw new ValidationError("CalibrationProfile: 'effectiveSampleCount' nesmí být záporné.");
    }
    if (!Number.isFinite(props.confidenceScore) || props.confidenceScore < 0 || props.confidenceScore > 1) {
      throw new ValidationError("CalibrationProfile: 'confidenceScore' musí být v rozsahu 0..1.");
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("CalibrationProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new CalibrationProfile(props);
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
  get name(): string {
    return this.props.name;
  }
  get description(): string | undefined {
    return this.props.description;
  }
  get scope(): CalibrationProfileScope {
    return this.props.scope;
  }
  get operationCategory(): OperationCategory | undefined {
    return this.props.operationCategory;
  }
  get operationSubtype(): string | undefined {
    return this.props.operationSubtype;
  }
  get machineProfileId(): string | undefined {
    return this.props.machineProfileId;
  }
  get materialGroupId(): string | undefined {
    return this.props.materialGroupId;
  }
  get toolTypeId(): string | undefined {
    return this.props.toolTypeId;
  }
  get workstationId(): string | undefined {
    return this.props.workstationId;
  }
  get coefficientTargets(): readonly CoefficientTarget[] {
    return this.props.coefficientTargets;
  }
  get sampleCount(): number {
    return this.props.sampleCount;
  }
  get effectiveSampleCount(): number {
    return this.props.effectiveSampleCount;
  }
  get coefficientValues(): Readonly<Partial<Record<CalibrationCoefficientTargetName, number>>> {
    return this.props.coefficientValues;
  }
  get confidenceScore(): number {
    return this.props.confidenceScore;
  }
  get status(): CalibrationProfileStatus {
    return this.props.status;
  }
  get calibrationMethod(): string {
    return this.props.calibrationMethod;
  }
  get validFrom(): string {
    return this.props.validFrom;
  }
  get validTo(): string | undefined {
    return this.props.validTo;
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
  get parentVersionId(): string | undefined {
    return this.props.parentVersionId;
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

  isValidAt(atIso: string): boolean {
    if (this.props.archivedAt) return false;
    if (atIso < this.props.validFrom) return false;
    if (this.props.validTo && atIso > this.props.validTo) return false;
    return true;
  }

  /** Jediný stav, který smí `CalibrationProfileResolver`/`CalculationContext
   *  Resolver` skutečně POUŽÍT ve výpočtu (§19 "pouze active, approved,
   *  časově platný, tenantově správný profil"). */
  get isUsableInCalculation(): boolean {
    return this.props.status === "active";
  }

  approve(approvedBy: string, approvedAt: string): CalibrationProfile {
    return new CalibrationProfile({ ...this.props, status: "approved", approvedBy, approvedAt, updatedAt: approvedAt });
  }

  activate(activatedAt: string): CalibrationProfile {
    return new CalibrationProfile({ ...this.props, status: "active", updatedAt: activatedAt });
  }

  reject(rejectedAt: string): CalibrationProfile {
    return new CalibrationProfile({ ...this.props, status: "rejected", updatedAt: rejectedAt });
  }

  /** Nahrazení starou verzí NOVOU (§13/§18) - stará verze zůstane v úložišti
   *  beze změny obsahu, jen `status` přejde na `"superseded"` (nikdy se
   *  nemaže, auditní stopa musí zůstat). */
  supersede(supersededAt: string): CalibrationProfile {
    return new CalibrationProfile({ ...this.props, status: "superseded", updatedAt: supersededAt });
  }

  archive(archivedAt: string): CalibrationProfile {
    return new CalibrationProfile({ ...this.props, status: "archived", archivedAt, updatedAt: archivedAt });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, coefficientTargets: [...this.props.coefficientTargets], coefficientValues: { ...this.props.coefficientValues } };
  }
}
