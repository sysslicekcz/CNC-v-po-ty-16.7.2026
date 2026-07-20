import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Délka v milimetrech - interní SI jednotka (AP-MCE-001, §22). Pokrývá délku
 * obrábění, dráhu nástroje, zdvih atd. Nula je platná hodnota (např.
 * `approachMm`/`retractMm` mohou být nulové), záporná ne.
 *
 * `Diameter` je záměrně SAMOSTATNÝ hodnotový objekt (ne `Length` s jiným
 * jménem) - průměr musí být vždy ostře kladný (nulový/záporný průměr je vždy
 * chyba vstupu), zatímco obecná délka nulu připouští. Viz `diameter.ts`.
 */
export class Length {
  private constructor(private readonly millimeters_: number) {}

  static ofMillimeters(millimeters: number): Length {
    if (!Number.isFinite(millimeters) || millimeters < 0) {
      throw new ValidationError(`Délka nesmí být záporná, dostal jsem "${millimeters}" mm.`);
    }
    return new Length(millimeters);
  }

  /** Pohodlný převod pro budoucí imperiální zobrazení (AP-MCE-001 §22) - vstup
   *  do domény zůstává vždy mm, palce se převádí až na hranici Presentation. */
  static ofInches(inches: number): Length {
    if (!Number.isFinite(inches) || inches < 0) {
      throw new ValidationError(`Délka nesmí být záporná, dostal jsem "${inches}" in.`);
    }
    return new Length(inches * 25.4);
  }

  static zero(): Length {
    return new Length(0);
  }

  get millimeters(): number {
    return this.millimeters_;
  }

  get inches(): number {
    return this.millimeters_ / 25.4;
  }

  plus(other: Length): Length {
    return new Length(this.millimeters_ + other.millimeters_);
  }

  minus(other: Length): Length {
    return Length.ofMillimeters(this.millimeters_ - other.millimeters_);
  }

  toString(): string {
    return `${this.millimeters_} mm`;
  }

  toJSON(): number {
    return this.millimeters_;
  }

  static fromJSON(millimeters: number): Length {
    return Length.ofMillimeters(millimeters);
  }
}
