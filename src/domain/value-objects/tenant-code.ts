import { ValidationError } from "../errors/validation-error";

/** Krátký stabilní kód tenanta (organizace provozující appku), např. "LOCAL".
 *  Stejná validační pravidla jako MachineCode - neprázdný, ořízlé mezery, beze
 *  změny velikosti písmen. */
export class TenantCode {
  private constructor(private readonly value: string) {}

  static create(value: string): TenantCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("TenantCode nesmí být prázdný.");
    }
    return new TenantCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): TenantCode {
    return TenantCode.create(value);
  }

  equals(other: TenantCode): boolean {
    return this.value === other.value;
  }
}
