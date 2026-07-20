import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Výkon v kilowattech - AP-MCE-001 §18 řadí "překročení výkonu stroje" mezi
 * `warning` stavy (ne blokující `error`, na rozdíl od překročení rozměrů
 * pracovního prostoru). Používá se jak pro `Machine.maxPowerKw` (existující
 * pole), tak pro odvozený požadovaný výkon operace v pozdější fázi.
 */
export class MachinePower {
  private constructor(private readonly kilowatts_: number) {}

  static ofKilowatts(kilowatts: number): MachinePower {
    if (!Number.isFinite(kilowatts) || kilowatts < 0) {
      throw new ValidationError(`Výkon nesmí být záporný, dostal jsem "${kilowatts}" kW.`);
    }
    return new MachinePower(kilowatts);
  }

  static zero(): MachinePower {
    return new MachinePower(0);
  }

  get kilowatts(): number {
    return this.kilowatts_;
  }

  /** `true`, pokud tenhle výkon (typicky požadovaný operací) překračuje
   *  `available` (typicky `MachineProfile.maxPowerKw`) - volající se podle
   *  toho rozhodne vyhodit `MachineLimitError` nebo jen varování. */
  exceeds(available: MachinePower): boolean {
    return this.kilowatts_ > available.kilowatts_;
  }

  toString(): string {
    return `${this.kilowatts_} kW`;
  }

  toJSON(): number {
    return this.kilowatts_;
  }

  static fromJSON(kilowatts: number): MachinePower {
    return MachinePower.ofKilowatts(kilowatts);
  }
}
