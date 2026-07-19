import { ValidationError } from "../errors/validation-error";

// Záměrně jednoduchá validace (ne plný RFC 5322) - stačí odchytit překlepy ve formuláři.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(private readonly value: string) {}

  static of(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new ValidationError(`Neplatný e-mail: "${raw}"`);
    }
    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): Email {
    return Email.of(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
