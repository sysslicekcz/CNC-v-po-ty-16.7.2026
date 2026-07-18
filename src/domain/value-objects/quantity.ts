import { ValidationError } from "../errors/validation-error";

/** Množství dílu - číslo drží pohromadě s jednotkou, aby se nedaly rozejít
 *  (např. "5" beze smyslu bez "ks"/"kg"). */
export class Quantity {
  private constructor(
    private readonly hodnota: number,
    private readonly jednotka: string
  ) {}

  static of(hodnota: number, jednotka: string): Quantity {
    if (!Number.isFinite(hodnota) || hodnota <= 0) {
      throw new ValidationError(`Množství musí být kladné číslo, dostal jsem "${hodnota}".`);
    }
    if (!jednotka.trim()) {
      throw new ValidationError("Množství musí mít jednotku.");
    }
    return new Quantity(hodnota, jednotka.trim());
  }

  get value(): number {
    return this.hodnota;
  }

  get unit(): string {
    return this.jednotka;
  }

  toString(): string {
    return `${this.hodnota} ${this.jednotka}`;
  }
}
