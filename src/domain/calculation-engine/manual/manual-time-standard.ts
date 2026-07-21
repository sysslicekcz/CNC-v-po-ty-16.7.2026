import { ValidationError } from "@/domain/errors/validation-error";
import type { ManualOperationSubtype, ManualQuantityBasis } from "./manual-operation-subtype";
import type { ComplexityLevel } from "./manual-operation-feature";

/** AP-MCE-001 Fáze F §5 "Podporuj zdroje" - jeden standard nese PŘESNĚ jeden
 *  zdroj, nikdy kombinaci (stejná zásada jako `CuttingConditionSource` Fáze
 *  B). `system_default` řádky mají VŽDY `tenantId === undefined` (globální,
 *  seedovaná appkou) - žádný `ManualTimeStandard.withChanges()` je nesmí
 *  přepsat (§5 "Systémový standard nesmí být přepsán zákaznickou úpravou"),
 *  tenant standard je vždy SAMOSTATNÝ řádek s vlastním `tenantId`, ne
 *  korekce/patch nad systémovým (overlay bez korekční třídy navíc - viz
 *  `resolveManualTimeStandard` pro plné zdůvodnění, proč tohle stačí
 *  namísto párové `Correction` entity jako u Fáze B profilů). */
export type ManualTimeStandardSource = "system_default" | "tenant_standard" | "historical_average" | "imported" | "manually_defined" | "external_method";

export interface ManualTimeStandardComplexityRange {
  min: ComplexityLevel;
  max: ComplexityLevel;
}

export interface ManualTimeStandardProps {
  id: string;
  /** `undefined` = systémový (globální) standard - jediné povolené `tenantId`
   *  pro `source === "system_default"`. Tenant standard MUSÍ mít vyplněné. */
  tenantId?: string;
  siteId?: string;
  operationSubtype: ManualOperationSubtype;
  standardName: string;
  standardVersion: string;
  source: ManualTimeStandardSource;
  baseTimeMin: number;
  quantityBasis: ManualQuantityBasis;
  complexityRange?: ManualTimeStandardComplexityRange;
  validFrom: string;
  validTo?: string;
  approvedBy?: string;
  approvedAt?: string;
  archivedAt?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * `ManualTimeStandard` (AP-MCE-001 Fáze F §5) - verzovaný časový standard
 * pro ruční operace, referenční alternativa k explicitnímu `baseTimeMin` na
 * featuru. Immutable po vytvoření (stejná disciplína jako `MaterialProfile`
 * apod.) - úprava vytváří NOVOU verzi/nový řádek, nikdy nemutuje existující.
 */
export class ManualTimeStandard {
  private readonly props: Readonly<ManualTimeStandardProps>;

  private constructor(props: ManualTimeStandardProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: ManualTimeStandardProps): ManualTimeStandard {
    if (!props.id.trim()) throw new ValidationError("ManualTimeStandard: 'id' nesmí být prázdné.");
    if (props.source === "system_default" && props.tenantId !== undefined) {
      throw new ValidationError("ManualTimeStandard: systémový standard ('system_default') nesmí mít vyplněné 'tenantId'.");
    }
    if (props.source !== "system_default" && !props.tenantId?.trim()) {
      throw new ValidationError(`ManualTimeStandard: standard se zdrojem "${props.source}" musí mít vyplněné 'tenantId'.`);
    }
    if (!Number.isFinite(props.baseTimeMin) || props.baseTimeMin < 0) {
      throw new ValidationError(`ManualTimeStandard: 'baseTimeMin' nesmí být záporné, dostal jsem "${props.baseTimeMin}".`);
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("ManualTimeStandard: 'recordVersion' musí být kladné celé číslo.");
    }
    return new ManualTimeStandard(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string | undefined {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get operationSubtype(): ManualOperationSubtype {
    return this.props.operationSubtype;
  }
  get standardName(): string {
    return this.props.standardName;
  }
  get standardVersion(): string {
    return this.props.standardVersion;
  }
  get source(): ManualTimeStandardSource {
    return this.props.source;
  }
  get baseTimeMin(): number {
    return this.props.baseTimeMin;
  }
  get quantityBasis(): ManualQuantityBasis {
    return this.props.quantityBasis;
  }
  get complexityRange(): ManualTimeStandardComplexityRange | undefined {
    return this.props.complexityRange;
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
  get archivedAt(): string | undefined {
    return this.props.archivedAt;
  }
  get isArchived(): boolean {
    return this.props.archivedAt !== undefined;
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

  /** `true`, pokud je standard platný k danému okamžiku (§5 `validFrom`/
   *  `validTo`) a není archivovaný. */
  isValidAt(atIso: string): boolean {
    if (this.props.archivedAt) return false;
    if (atIso < this.props.validFrom) return false;
    if (this.props.validTo && atIso > this.props.validTo) return false;
    return true;
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props };
  }
}
