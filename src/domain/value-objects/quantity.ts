import { ValidationError } from "../errors/validation-error";

/** Množství dílu - hodnota drží pohromadě s jednotkou, aby se nedaly rozejít
 *  (např. "5" beze smyslu bez "ks"/"kg"). Nula je platná hodnota (např. zatím
 *  nevyrobeno), záporná ne. */
export class Quantity {
  private constructor(
    private readonly value_: number,
    private readonly unit_: string
  ) {}

  static of(value: number, unit: string): Quantity {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError(`Množství nesmí být záporné, dostal jsem "${value}".`);
    }
    if (!unit.trim()) {
      throw new ValidationError("Množství musí mít jednotku.");
    }
    return new Quantity(value, unit.trim());
  }

  get value(): number {
    return this.value_;
  }

  get unit(): string {
    return this.unit_;
  }

  toString(): string {
    return `${this.value_} ${this.unit_}`;
  }

  toJSON(): { value: number; unit: string } {
    return { value: this.value_, unit: this.unit_ };
  }

  static fromJSON(json: { value: number; unit: string }): Quantity {
    return Quantity.of(json.value, json.unit);
  }
}
