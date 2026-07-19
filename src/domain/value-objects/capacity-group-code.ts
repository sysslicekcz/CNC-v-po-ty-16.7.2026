import { ValidationError } from "../errors/validation-error";

/** Kód sdílené fyzické kapacity (např. "capacity:puma-700"), unikátní v rámci
 *  tenanta - viz CapacityGroup, docs/adr/0017. Stejná validace jako MachineCode. */
export class CapacityGroupCode {
  private constructor(private readonly value: string) {}

  static create(value: string): CapacityGroupCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("CapacityGroupCode nesmí být prázdný.");
    }
    return new CapacityGroupCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): CapacityGroupCode {
    return CapacityGroupCode.create(value);
  }

  equals(other: CapacityGroupCode): boolean {
    return this.value === other.value;
  }
}
