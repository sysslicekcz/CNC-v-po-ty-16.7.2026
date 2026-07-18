import { ValidationError } from "../errors/validation-error";

/** Kód externího kooperačního zdroje (např. "KOOP-TEP"), unikátní v rámci
 *  tenanta - viz ExternalOperationResource, docs/adr/0018. Stejná validace jako
 *  MachineCode. */
export class ExternalResourceCode {
  private constructor(private readonly value: string) {}

  static create(value: string): ExternalResourceCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("ExternalResourceCode nesmí být prázdný.");
    }
    return new ExternalResourceCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): ExternalResourceCode {
    return ExternalResourceCode.create(value);
  }

  equals(other: ExternalResourceCode): boolean {
    return this.value === other.value;
  }
}
