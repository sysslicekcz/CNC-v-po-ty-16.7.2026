import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Životnost nástroje - AP-MCE-001 §08 připouští dvě jednotky ("toolLifePieces
 * NEBO toolLifeMinutes"), nikdy obě zároveň (nástroj má buď životnost danou
 * počtem kusů, nebo časem řezu, ne obojí současně - kdyby modul znal obě,
 * nebylo by jasné, která platí pro výpočet počtu výměn v dávce).
 *
 * `unlimited()` pokrývá nástroje bez sledované životnosti (AP-MCE-001 §18:
 * "chybějící řezné podmínky"/"upozornit na nevhodnou kombinaci" - chybějící
 * životnost sama o sobě není chyba, jen se nepočítají výměny v průběhu dávky).
 */
export type ToolLifeBasis = "pieces" | "minutes" | "unlimited";

export class ToolLife {
  private constructor(
    private readonly basis_: ToolLifeBasis,
    private readonly value_: number
  ) {}

  static ofPieces(pieces: number): ToolLife {
    if (!Number.isFinite(pieces) || pieces <= 0) {
      throw new ValidationError(`Životnost v kusech musí být kladné číslo, dostal jsem "${pieces}".`);
    }
    return new ToolLife("pieces", pieces);
  }

  static ofMinutes(minutes: number): ToolLife {
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new ValidationError(`Životnost v minutách musí být kladné číslo, dostal jsem "${minutes}".`);
    }
    return new ToolLife("minutes", minutes);
  }

  static unlimited(): ToolLife {
    return new ToolLife("unlimited", Number.POSITIVE_INFINITY);
  }

  get basis(): ToolLifeBasis {
    return this.basis_;
  }

  get value(): number {
    return this.value_;
  }

  /** Počet plánovaných výměn nástroje v dávce o `quantity` kusech
   *  (AP-MCE-001 §03: `ToolChangeTime × ceil(quantity / toolLifePieces)`).
   *  Vrací 0 pro `unlimited` nebo pro životnost danou minutami (tu zatím
   *  neumí modul v Fázi A převést na počet kusů - potřebuje `unitTime`
   *  jedné operace, což je věc konkrétní strategie z pozdější fáze). */
  plannedChangesForBatch(quantity: number): number {
    if (this.basis_ !== "pieces") return 0;
    if (!Number.isFinite(quantity) || quantity <= 0) return 0;
    return Math.ceil(quantity / this.value_);
  }

  toString(): string {
    if (this.basis_ === "unlimited") return "neomezená";
    return this.basis_ === "pieces" ? `${this.value_} ks` : `${this.value_} min`;
  }

  toJSON(): { basis: ToolLifeBasis; value: number } {
    return { basis: this.basis_, value: this.basis_ === "unlimited" ? 0 : this.value_ };
  }

  static fromJSON(json: { basis: ToolLifeBasis; value: number }): ToolLife {
    if (json.basis === "unlimited") return ToolLife.unlimited();
    return json.basis === "pieces" ? ToolLife.ofPieces(json.value) : ToolLife.ofMinutes(json.value);
  }
}
