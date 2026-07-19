import { ValidationError } from "../errors/validation-error";

/** Podnikový kód materiálové skupiny (Krok 5), unikátní v rámci tenanta -
 *  stejná validace jako MachineCode. */
export class MaterialGroupCode {
  private constructor(private readonly value: string) {}

  static create(value: string): MaterialGroupCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("MaterialGroupCode nesmí být prázdný.");
    }
    return new MaterialGroupCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): MaterialGroupCode {
    return MaterialGroupCode.create(value);
  }

  equals(other: MaterialGroupCode): boolean {
    return this.value === other.value;
  }
}
