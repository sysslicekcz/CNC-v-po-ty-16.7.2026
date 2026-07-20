import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Doba trvání v minutách - jednotný interní jednotkový systém pro CELÝ
 * Manufacturing Calculation Engine (AP-MCE-001, §22 "Units": interně vždy SI,
 * převod na jiné zobrazení patří až do Presentation vrstvy). Všechny složky
 * `CalculationBreakdown` (setup, kusový čas, dávkový čas, ...) jsou `Time`,
 * nikdy holé `number` - zabraňuje omylem sečíst minuty se sekundami.
 *
 * Záporná hodnota není nikdy platná. Nula je platná (např. `waitingTime` když
 * se nečekalo).
 */
export class Time {
  private constructor(private readonly minutes_: number) {}

  static ofMinutes(minutes: number): Time {
    if (!Number.isFinite(minutes) || minutes < 0) {
      throw new ValidationError(`Čas nesmí být záporný, dostal jsem "${minutes}" min.`);
    }
    return new Time(minutes);
  }

  static ofSeconds(seconds: number): Time {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new ValidationError(`Čas nesmí být záporný, dostal jsem "${seconds}" s.`);
    }
    return new Time(seconds / 60);
  }

  static zero(): Time {
    return new Time(0);
  }

  get minutes(): number {
    return this.minutes_;
  }

  get seconds(): number {
    return this.minutes_ * 60;
  }

  get isZero(): boolean {
    return this.minutes_ === 0;
  }

  /** Nová instance - `Time` je immutable, žádná operace nemění `this`. */
  plus(other: Time): Time {
    return new Time(this.minutes_ + other.minutes_);
  }

  /** `factor` typicky jeden z koeficientů z AP-MCE-001 §03 (Layer 2) nebo
   *  `Quantity.value` při rozpočtu dávky (Layer 1 -> variabilní čas dávky). */
  times(factor: number): Time {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new ValidationError(`Násobitel času nesmí být záporný, dostal jsem "${factor}".`);
    }
    return new Time(this.minutes_ * factor);
  }

  /** Přirážka podle AP-MCE-001 §03 Layer 3 - `percentage` je desetinné číslo
   *  (0.1 = 10 %), aplikuje se multiplikativně, ale POUZE na tenhle jeden
   *  krok skládání (nikdy neschovává korekční koeficienty z Layer 2). */
  withPercentageAllowance(percentage: number): Time {
    if (!Number.isFinite(percentage) || percentage < 0) {
      throw new ValidationError(`Procentní přirážka nesmí být záporná, dostal jsem "${percentage}".`);
    }
    return new Time(this.minutes_ * (1 + percentage));
  }

  compareTo(other: Time): number {
    return this.minutes_ - other.minutes_;
  }

  toString(): string {
    return `${this.minutes_.toFixed(2)} min`;
  }

  toJSON(): number {
    return this.minutes_;
  }

  static fromJSON(minutes: number): Time {
    return Time.ofMinutes(minutes);
  }
}
