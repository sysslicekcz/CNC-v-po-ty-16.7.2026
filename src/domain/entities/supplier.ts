import { ValidationError } from "../errors/validation-error";
import { SupplierCode } from "../value-objects/supplier-code";
import { MasterDataStatus } from "./master-data-status";

export interface SupplierProps {
  id: string;
  tenantId: string;
  code?: SupplierCode;
  name: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  status: MasterDataStatus;
  note?: string;
}

/**
 * Minimální model dodavatele (Krok 5, zadání bod 16) - jen tolik, kolik
 * potřebuje `ExternalOperationResource.supplierId`, ŽÁDNÝ nákupní/skladový
 * modul. `Supplier` NENÍ totéž jako `Customer` (existující entita z Kroku 1) -
 * i když jedna firma může v realitě být obojí, doména je drží odděleně (zadání
 * to explicitně vyžaduje), protože nemají stejný účel (Customer = komu appka
 * fakturuje/pro koho vyrábí, Supplier = kdo appce dodává kooperaci) a časem by
 * mohly potřebovat nezávisle rozdílná pole.
 */
export class Supplier {
  private constructor(private props: SupplierProps) {}

  static create(props: SupplierProps): Supplier {
    if (!props.tenantId.trim()) throw new ValidationError("Supplier: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("Supplier: 'name' nesmí být prázdné.");
    return new Supplier({ ...props });
  }

  static restore(props: SupplierProps): Supplier {
    return new Supplier({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): SupplierCode | undefined {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get registrationNumber(): string | undefined {
    return this.props.registrationNumber;
  }
  get email(): string | undefined {
    return this.props.email;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get status(): MasterDataStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("Supplier: 'name' nesmí být prázdné.");
    this.props.name = name;
  }

  changeCode(code: SupplierCode | undefined): void {
    this.props.code = code;
  }

  updateDetails(input: { registrationNumber?: string; email?: string; phone?: string; note?: string }): void {
    if (input.registrationNumber !== undefined) this.props.registrationNumber = input.registrationNumber || undefined;
    if (input.email !== undefined) this.props.email = input.email || undefined;
    if (input.phone !== undefined) this.props.phone = input.phone || undefined;
    if (input.note !== undefined) this.props.note = input.note || undefined;
  }

  setStatus(status: MasterDataStatus): void {
    this.props.status = status;
  }
}
