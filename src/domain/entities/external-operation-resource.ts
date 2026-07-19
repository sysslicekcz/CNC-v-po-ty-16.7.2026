import { ValidationError } from "../errors/validation-error";
import { ExternalResourceCode } from "../value-objects/external-resource-code";
import { Money } from "../value-objects/money";
import { MasterDataStatus } from "./master-data-status";

export type ExternalResourceStatus = MasterDataStatus;

export interface ExternalOperationResourceProps {
  id: string;
  tenantId: string;
  code: ExternalResourceCode;
  name: string;
  supplierId?: string;
  /** Které typy operací tahle kooperace typicky pokrývá (Krok 5, zadání bod 15) -
   *  informativní filtr pro editor postupu, ne tvrdé omezení (kooperaci lze
   *  přiřadit operaci i mimo tenhle seznam). */
  supportedOperationTypeIds?: string[];
  defaultLeadTimeDays?: number;
  defaultCost?: Money;
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
  get supportedOperationTypeIds(): readonly string[] | undefined {
    return this.props.supportedOperationTypeIds;
  }
  get defaultLeadTimeDays(): number | undefined {
    return this.props.defaultLeadTimeDays;
  }
  get defaultCost(): Money | undefined {
    return this.props.defaultCost;
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

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("ExternalOperationResource: 'name' nesmí být prázdné.");
    this.props.name = name;
  }

  changeCode(code: ExternalResourceCode): void {
    this.props.code = code;
  }

  updateDetails(input: {
    supplierId?: string;
    supportedOperationTypeIds?: string[];
    defaultLeadTimeDays?: number;
    defaultCost?: Money;
    note?: string;
  }): void {
    if (input.supplierId !== undefined) this.props.supplierId = input.supplierId || undefined;
    if (input.supportedOperationTypeIds !== undefined) this.props.supportedOperationTypeIds = input.supportedOperationTypeIds;
    if (input.defaultLeadTimeDays !== undefined) this.props.defaultLeadTimeDays = input.defaultLeadTimeDays;
    if (input.defaultCost !== undefined) this.props.defaultCost = input.defaultCost;
    if (input.note !== undefined) this.props.note = input.note || undefined;
  }
}
