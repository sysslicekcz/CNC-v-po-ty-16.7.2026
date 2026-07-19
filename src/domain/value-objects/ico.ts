import { ValidationError } from "../errors/validation-error";

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2];

function isValidChecksum(digits: string): boolean {
  const sum = WEIGHTS.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
  const mod = sum % 11;
  const check = mod === 0 ? 1 : mod === 1 ? 0 : 11 - mod;
  return check === Number(digits[7]);
}

/** České IČO - 8 číslic s kontrolním součtem (mod 11). */
export class Ico {
  private constructor(private readonly value: string) {}

  static of(raw: string): Ico {
    const digits = raw.trim();
    if (!/^\d{8}$/.test(digits) || !isValidChecksum(digits)) {
      throw new ValidationError(`Neplatné IČO: "${raw}"`);
    }
    return new Ico(digits);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): Ico {
    return Ico.of(value);
  }

  equals(other: Ico): boolean {
    return this.value === other.value;
  }
}
