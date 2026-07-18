import { ValidationError } from "../errors/validation-error";

/** Lokální entity appky, na které se smí externí systém odkazovat. Uzavřený
 *  union - rozšíření o novou lokální entitu je vědomá doménová změna. */
export type ExternalReferenceEntityType =
  | "customer"
  | "order"
  | "part"
  | "routingSheet"
  | "operation"
  | "machine"
  | "capacityGroup"
  | "operationType"
  | "tool"
  | "externalOperationResource";

export interface ExternalReferenceProps {
  id: string;
  tenantId: string;
  externalSystemId: string;
  localEntityType: ExternalReferenceEntityType;
  localEntityId: string;
  /** Otevřený řetězec - jak konkrétní systém sám nazývá svou entitu
   *  ("workplace", "resource", "machine-card", ...). Doména se na tuhle
   *  hodnotu neptá, jen ji ukládá a vrací. */
  externalEntityType: string;
  externalId?: string;
  externalCode?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vazba JEDNÉ lokální entity (identifikované interním `localEntityId`) na
 * záznam v JEDNOM konkrétním `ExternalSystem`. Jedna lokální entita může mít
 * víc `ExternalReference` napříč různými externími systémy současně
 * (Machine.id -> reference do Heliosu, reference do MES, reference do jiného
 * ERP) - externí reference NIKDY nenahrazuje interní id (viz
 * docs/adr/external-system-reference-mapping.md). `externalId` není
 * globálně unikátní - stejná hodnota smí existovat nezávisle na sobě ve dvou
 * různých `ExternalSystem` záznamech, unikátnost se posuzuje jen v rámci
 * `[externalSystemId, externalEntityType, externalId]`.
 */
export class ExternalReference {
  private constructor(private props: ExternalReferenceProps) {}

  static create(props: ExternalReferenceProps): ExternalReference {
    if (!props.tenantId.trim()) throw new ValidationError("ExternalReference: 'tenantId' nesmí být prázdné.");
    if (!props.externalSystemId.trim()) {
      throw new ValidationError("ExternalReference: 'externalSystemId' nesmí být prázdné.");
    }
    if (!props.localEntityId.trim()) throw new ValidationError("ExternalReference: 'localEntityId' nesmí být prázdné.");
    if (!props.externalEntityType.trim()) {
      throw new ValidationError("ExternalReference: 'externalEntityType' nesmí být prázdný.");
    }
    if (!props.externalId?.trim() && !props.externalCode?.trim()) {
      throw new ValidationError("ExternalReference: musí být vyplněné aspoň jedno z 'externalId'/'externalCode'.");
    }
    return new ExternalReference({ ...props });
  }

  static restore(props: ExternalReferenceProps): ExternalReference {
    return new ExternalReference({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get externalSystemId(): string {
    return this.props.externalSystemId;
  }
  get localEntityType(): ExternalReferenceEntityType {
    return this.props.localEntityType;
  }
  get localEntityId(): string {
    return this.props.localEntityId;
  }
  get externalEntityType(): string {
    return this.props.externalEntityType;
  }
  get externalId(): string | undefined {
    return this.props.externalId;
  }
  get externalCode(): string | undefined {
    return this.props.externalCode;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }

  updateExternalIdentity(params: { externalId?: string; externalCode?: string; updatedAt: string }): void {
    if (!params.externalId?.trim() && !params.externalCode?.trim()) {
      throw new ValidationError("ExternalReference: musí být vyplněné aspoň jedno z 'externalId'/'externalCode'.");
    }
    this.props.externalId = params.externalId;
    this.props.externalCode = params.externalCode;
    this.props.updatedAt = params.updatedAt;
  }
}
