import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Průměr obrobku/nástroje v milimetrech - AP-MCE-001 §18 explicitně požaduje
 * validaci "nulové rozměry"/"záporné hodnoty" jako `error`, ne jen `warning`.
 * Na rozdíl od obecné `Length` je tu nula VŽDY neplatná - nulový průměr nemá
 * v žádné z operací (soustružení/frézování/broušení) fyzikální smysl.
 */
export class Diameter {
  private constructor(private readonly millimeters_: number) {}

  static ofMillimeters(millimeters: number): Diameter {
    if (!Number.isFinite(millimeters) || millimeters <= 0) {
      throw new ValidationError(`Průměr musí být kladný, dostal jsem "${millimeters}" mm.`);
    }
    return new Diameter(millimeters);
  }

  get millimeters(): number {
    return this.millimeters_;
  }

  get radiusMillimeters(): number {
    return this.millimeters_ / 2;
  }

  toString(): string {
    return `⌀${this.millimeters_} mm`;
  }

  toJSON(): number {
    return this.millimeters_;
  }

  static fromJSON(millimeters: number): Diameter {
    return Diameter.ofMillimeters(millimeters);
  }
}
