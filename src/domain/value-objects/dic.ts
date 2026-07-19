import { ValidationError } from "../errors/validation-error";

// Dvoupísmenný kód země + 8-10 číslic (např. CZ12345678) - záměrně bez ověření mod 11,
// to je vázané na IČO plátce a liší se pro fyzické/právnické osoby. Nepředpokládá se
// jen ČR - kód země je libovolný dvoupísmenný ISO kód, ne pevně "CZ".
const DIC_PATTERN = /^[A-Z]{2}\d{8,10}$/;

export class Dic {
  private constructor(private readonly value: string) {}

  static of(raw: string): Dic {
    const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
    if (!DIC_PATTERN.test(normalized)) {
      throw new ValidationError(`Neplatné DIČ: "${raw}"`);
    }
    return new Dic(normalized);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): Dic {
    return Dic.of(value);
  }

  equals(other: Dic): boolean {
    return this.value === other.value;
  }
}
