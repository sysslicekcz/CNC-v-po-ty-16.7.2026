import { ValidationError } from "../errors/validation-error";
import { ExternalResourceCode } from "../value-objects/external-resource-code";

export type ExternalResourceStatus = "active" | "inactive";

export interface ExternalOperationResourceProps {
  id: string;
  tenantId: string;
  code: ExternalResourceCode;
  name: string;
  supplierId?: string;
  status: ExternalResourceStatus;
  note?: string;
}

/**
 * Kooperace (externí zpracování - tepelné zpracování, NDT, černění, ...).
 * Kooperace NENÍ Machine (docs/adr/0018) - je to jiný druh výrobního zdroje,
 * bez stroje/hodinové sazby/kapacit stroje. Samostatná entita, ne obecný
 * `Resource` model (ten by byl předčasná abstrakce, viz docs/adr/0010 a 0018).
 * Tenhle krok neimplementuje kompletní správu kooperací v UI - jen doménu,
 * repository a persistenci.
 */
export class ExternalOperationResource {
  private constructor(private props: ExternalOperationResourceProps) {}

  static create(props: ExternalOperationResourceProps): ExternalOperationResource {
    if (!props.tenantId.trim()) {
      throw new ValidationError("ExternalOperationResource: 'tenantId' nesmí být prázdné.");
    }
    if (!props.name.trim()) throw new ValidationError("ExternalOperationResource: 'name' nesmí být prázdné.");
    return new ExternalOperationResource({ ...props });
  }

  static restore(props: ExternalOperationResourceProps): ExternalOperationResource {
    return new ExternalOperationResource({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): ExternalResourceCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get supplierId(): string | undefined {
    return this.props.supplierId;
  }
  get status(): ExternalResourceStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  setStatus(status: ExternalResourceStatus): void {
    this.props.status = status;
  }
}
