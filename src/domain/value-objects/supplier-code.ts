import { ValidationError } from "../errors/validation-error";

/** Podnikový kód dodavatele (Krok 5) - volitelný na Supplier (stejné pravidlo
 *  jako Tool.code), pokud vyplněný, unikátní v rámci tenanta. Stejná validace
 *  jako MachineCode/CapacityGroupCode/ExternalResourceCode. */
export class SupplierCode {
  private constructor(private readonly value: string) {}

  static create(value: string): SupplierCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("SupplierCode nesmí být prázdný.");
    }
    return new SupplierCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): SupplierCode {
    return SupplierCode.create(value);
  }

  equals(other: SupplierCode): boolean {
    return this.value === other.value;
  }
}
