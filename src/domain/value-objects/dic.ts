import { ValidationError } from "../errors/validation-error";

const DIC_PATTERN = /^[A-Z]{2}\d{8,10}$/;

/** DIČ - dvoupísmenný kód země + 8-10 číslic (např. CZ12345678). Bez ověření mod 11 -
 *  to je vázané na IČO plátce a liší se pro fyzické/právnické osoby, zbytečná složitost teď. */
export class Dic {
  private constructor(private readonly value: string) {}

  static of(raw: string): Dic {
    const normalized = raw.trim().toUpperCase();
    if (!DIC_PATTERN.test(normalized)) {
      throw new ValidationError(`Neplatné DIČ: "${raw}"`);
    }
    return new Dic(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Dic): boolean {
    return this.value === other.value;
  }
}
