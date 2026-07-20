import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Počet kusů v dávce/výpočtu - AP-MCE-001 §18 vyžaduje "quantity > 0" jako
 * blokující chybu (výpočet pro 0 kusů nedává smysl, na rozdíl od obecného
 * množství v `domain/value-objects/quantity.ts`, které nulu připouští jako
 * "zatím nevyrobeno"). ZÁMĚRNĚ samostatný hodnotový objekt v tomto modulu,
 * ne přímé použití existujícího `Quantity` - Manufacturing Calculation Engine
 * je navržený jako samostatné, znovupoužitelné jádro (AP-MCE-001, úvod) a
 * nesmí kvůli jedné validační výjimce záviset na sémantice jiného modulu.
 *
 * Vždy celé číslo - "2.5 kusu" nedává smysl.
 */
export class Quantity {
  private constructor(private readonly pieces_: number) {}

  static ofPieces(pieces: number): Quantity {
    if (!Number.isFinite(pieces) || !Number.isInteger(pieces) || pieces <= 0) {
      throw new ValidationError(`Počet kusů musí být kladné celé číslo, dostal jsem "${pieces}".`);
    }
    return new Quantity(pieces);
  }

  get pieces(): number {
    return this.pieces_;
  }

  toString(): string {
    return `${this.pieces_} ks`;
  }

  toJSON(): number {
    return this.pieces_;
  }

  static fromJSON(pieces: number): Quantity {
    return Quantity.ofPieces(pieces);
  }
}
