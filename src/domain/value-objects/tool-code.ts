import { ValidationError } from "../errors/validation-error";

/** Volitelný podnikový/ERP kód nástroje (Tool.code, bod 18) - jen pokud ho
 *  zákazník skutečně používá. Pokud vyplněný, musí být unikátní v rámci
 *  tenanta (kontroluje use case, ne VO samo). Stejná validace jako MachineCode. */
export class ToolCode {
  private constructor(private readonly value: string) {}

  static create(value: string): ToolCode {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new ValidationError("ToolCode nesmí být prázdný.");
    }
    return new ToolCode(trimmed);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): ToolCode {
    return ToolCode.create(value);
  }

  equals(other: ToolCode): boolean {
    return this.value === other.value;
  }
}
