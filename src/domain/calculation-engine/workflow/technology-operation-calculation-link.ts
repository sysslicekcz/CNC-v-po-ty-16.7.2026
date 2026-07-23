import { ValidationError } from "@/domain/errors/validation-error";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";

/** AP-MCE-001 Fáze H §17 - přesně čtyři stavy vazby. */
export type TechnologyOperationCalculationLinkStatus = "draft" | "active" | "superseded" | "detached";

export interface TechnologyOperationCalculationLinkProps {
  id: string;
  tenantId: string;
  technologyOperationId: string;
  calculationId: string;
  calculationRevision: number;
  linkStatus: TechnologyOperationCalculationLinkStatus;
  linkedBy: string;
  linkedAt: string;
  unlinkedAt?: string;
  externalReferences: readonly ExternalReferenceSummary[];
  recordVersion: number;
}

/**
 * `TechnologyOperationCalculationLink` (AP-MCE-001 Fáze H §17) - vazba MEZI
 * technologickou operací (`Operation`, `domain/aggregates/routing-sheet`) a
 * KONKRÉTNÍ immutable revizí `CalculationResult`. Technologická operace
 * NIKDY nekopíruje celý `CalculationResult` (§17 "nesmí kopírovat celý
 * CalculationResult, musí odkazovat na konkrétní immutable revizi") - jen
 * `calculationId` + `calculationRevision` (číslo revize v řetězci
 * `supersedesResultId`, stejný koncept jako Fáze G
 * `MatchActualTimeToCalculationUseCase`).
 *
 * Odpojení (`detach`) NIKDY neodstraní historický záznam (§17 "zachovat
 * historii vazeb") - jen změní `linkStatus` na `"detached"` a doplní
 * `unlinkedAt`, stejná disciplína jako `CalibrationProfile.supersede`/
 * `ActualTimeRecord.archive` (Fáze G).
 */
export class TechnologyOperationCalculationLink {
  private readonly props: Readonly<TechnologyOperationCalculationLinkProps>;

  private constructor(props: TechnologyOperationCalculationLinkProps) {
    this.props = Object.freeze({ ...props, externalReferences: Object.freeze([...props.externalReferences]) });
  }

  static create(props: TechnologyOperationCalculationLinkProps): TechnologyOperationCalculationLink {
    if (!props.id.trim()) throw new ValidationError("TechnologyOperationCalculationLink: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("TechnologyOperationCalculationLink: 'tenantId' nesmí být prázdné.");
    if (!props.technologyOperationId.trim()) throw new ValidationError("TechnologyOperationCalculationLink: 'technologyOperationId' nesmí být prázdné.");
    if (!props.calculationId.trim()) throw new ValidationError("TechnologyOperationCalculationLink: 'calculationId' nesmí být prázdné.");
    if (!Number.isInteger(props.calculationRevision) || props.calculationRevision < 1) {
      throw new ValidationError("TechnologyOperationCalculationLink: 'calculationRevision' musí být kladné celé číslo.");
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("TechnologyOperationCalculationLink: 'recordVersion' musí být kladné celé číslo.");
    }
    return new TechnologyOperationCalculationLink(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get technologyOperationId(): string {
    return this.props.technologyOperationId;
  }
  get calculationId(): string {
    return this.props.calculationId;
  }
  get calculationRevision(): number {
    return this.props.calculationRevision;
  }
  get linkStatus(): TechnologyOperationCalculationLinkStatus {
    return this.props.linkStatus;
  }
  get linkedBy(): string {
    return this.props.linkedBy;
  }
  get linkedAt(): string {
    return this.props.linkedAt;
  }
  get unlinkedAt(): string | undefined {
    return this.props.unlinkedAt;
  }
  get externalReferences(): readonly ExternalReferenceSummary[] {
    return this.props.externalReferences;
  }
  get recordVersion(): number {
    return this.props.recordVersion;
  }

  get isActive(): boolean {
    return this.props.linkStatus === "active";
  }

  activate(): TechnologyOperationCalculationLink {
    return new TechnologyOperationCalculationLink({ ...this.props, linkStatus: "active", recordVersion: this.props.recordVersion + 1 });
  }

  /** Přepočet vytvoří novou revizi `CalculationResult` (Fáze A-G disciplína) -
   *  stará vazba se označí jako `superseded`, NOVOU vazbu na novou revizi
   *  vytvoří `LinkCalculationToTechnologyOperationUseCase` jako samostatný
   *  záznam (stejný princip jako `CalibrationProfile.supersede`). */
  supersede(): TechnologyOperationCalculationLink {
    return new TechnologyOperationCalculationLink({ ...this.props, linkStatus: "superseded", recordVersion: this.props.recordVersion + 1 });
  }

  detach(unlinkedAt: string): TechnologyOperationCalculationLink {
    return new TechnologyOperationCalculationLink({ ...this.props, linkStatus: "detached", unlinkedAt, recordVersion: this.props.recordVersion + 1 });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, externalReferences: [...this.props.externalReferences] };
  }
}
