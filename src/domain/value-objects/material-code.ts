import { ValidationError } from "../errors/validation-error";

/** Podnikový kód materiálu (Krok 5), unikátní v rámci tenanta - stejná
 *  validace jako MachineCode. */
export class MaterialCode {
  private constructor(private readonly value: string) {}

  static create(value: string): MaterialCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("MaterialCode nesmí být prázdný.");
    }
    return new MaterialCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): MaterialCode {
    return MaterialCode.create(value);
  }

  equals(other: MaterialCode): boolean {
    return this.value === other.value;
  }
}
