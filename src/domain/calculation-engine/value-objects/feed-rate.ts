import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Posuv - AP-MCE-001 §04 rozlišuje tři různé významy podle typu operace
 * ("posuv na otáčku" u soustružení, "posuv na zub" u frézování, "rychlost
 * posuvu" u broušení v mm/min) - `unit` nese, o který jde, aby se nesečetly
 * neslučitelné veličiny (mm/ot + mm/zub by byl nesmysl). Hodnota smí být 0
 * (nevyplněný/nepoužitý posuv u operace, která ho nevyžaduje), záporná nikdy.
 */
export type FeedRateUnit = "mm_per_rev" | "mm_per_tooth" | "mm_per_min";

export class FeedRate {
  private constructor(
    private readonly value_: number,
    private readonly unit_: FeedRateUnit
  ) {}

  static of(value: number, unit: FeedRateUnit): FeedRate {
    if (!Number.isFinite(value) || value < 0) {
      throw new ValidationError(`Posuv nesmí být záporný, dostal jsem "${value}" (${unit}).`);
    }
    return new FeedRate(value, unit);
  }

  get value(): number {
    return this.value_;
  }

  get unit(): FeedRateUnit {
    return this.unit_;
  }

  /** Vyžádá si hodnotu v konkrétní jednotce - použití: strategie, která umí
   *  pracovat jen s jedním tvarem posuvu, si takhle ověří, že nedostala jiný
   *  (např. `TurningCalculationStrategy` očekává `mm_per_rev`). */
  assertUnit(expected: FeedRateUnit): number {
    if (this.unit_ !== expected) {
      throw new ValidationError(`Očekával jsem posuv v "${expected}", dostal jsem "${this.unit_}".`);
    }
    return this.value_;
  }

  toString(): string {
    const suffix: Record<FeedRateUnit, string> = {
      mm_per_rev: "mm/ot",
      mm_per_tooth: "mm/zub",
      mm_per_min: "mm/min",
    };
    return `${this.value_} ${suffix[this.unit_]}`;
  }

  toJSON(): { value: number; unit: FeedRateUnit } {
    return { value: this.value_, unit: this.unit_ };
  }

  static fromJSON(json: { value: number; unit: FeedRateUnit }): FeedRate {
    return FeedRate.of(json.value, json.unit);
  }
}
