import { ValidationError } from "@/domain/errors/validation-error";
import { ToolLife } from "../value-objects/tool-life";

/**
 * Životnost nástroje (AP-MCE-001 Fáze B §4) - ROZŠIŘUJE Fáze A `ToolLife`
 * (životnost VÝHRADNĚ v kusech NEBO minutách NEBO neznámá), aby uměla nést
 * OBĚ hranice SOUČASNĚ ("životnost v kusech, v minutách řezu, obě hodnoty
 * současně" - AP-MCE-001 Fáze B §4). Fáze A `ToolLife` se nepřepisuje - je to
 * stavební kámen, `pieceLimit`/`timeLimit` jsou obě typu `ToolLife`.
 */
export class ToolLifeProfile {
  private constructor(
    private readonly pieceLimit_: ToolLife | undefined,
    private readonly timeLimit_: ToolLife | undefined
  ) {}

  static ofPieces(pieces: number): ToolLifeProfile {
    return new ToolLifeProfile(ToolLife.ofPieces(pieces), undefined);
  }

  static ofMinutes(minutes: number): ToolLifeProfile {
    return new ToolLifeProfile(undefined, ToolLife.ofMinutes(minutes));
  }

  static ofBoth(pieces: number, minutes: number): ToolLifeProfile {
    return new ToolLifeProfile(ToolLife.ofPieces(pieces), ToolLife.ofMinutes(minutes));
  }

  static unknown(): ToolLifeProfile {
    return new ToolLifeProfile(undefined, undefined);
  }

  get pieceLimit(): ToolLife | undefined {
    return this.pieceLimit_;
  }

  get timeLimit(): ToolLife | undefined {
    return this.timeLimit_;
  }

  get isUnknown(): boolean {
    return this.pieceLimit_ === undefined && this.timeLimit_ === undefined;
  }

  /**
   * Očekávaný počet výměn nástroje v dávce (AP-MCE-001 Fáze B §4: "výpočet
   * očekávaného počtu výměn nástroje"). Pokud jsou nastavené OBĚ hranice,
   * rozhoduje ta PŘÍSNĚJŠÍ (vyšší počet výměn) - nástroj se vymění, jakmile
   * dosáhne KTERÉKOLIV ze svých životností. `estimatedUnitTimeMinutes` je
   * nutný jen pro vyhodnocení časové hranice (kolik kusů se stihne za daný
   * čas) - bez něj se časová hranice přeskočí (0 výměn z ní), stejně jako u
   * Fáze A `ToolLife.plannedChangesForBatch` pro `"minutes"`/`"unlimited"`.
   */
  expectedToolChanges(quantity: number, estimatedUnitTimeMinutes?: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`ToolLifeProfile: 'quantity' musí být kladné číslo, dostal jsem "${quantity}".`);
    }
    const byPieces = this.pieceLimit_ ? Math.ceil(quantity / this.pieceLimit_.value) : 0;
    const byTime =
      this.timeLimit_ && estimatedUnitTimeMinutes && estimatedUnitTimeMinutes > 0
        ? Math.ceil((quantity * estimatedUnitTimeMinutes) / this.timeLimit_.value)
        : 0;
    return Math.max(byPieces, byTime);
  }

  toJSON(): { pieceLimitPieces?: number; timeLimitMinutes?: number } {
    return {
      pieceLimitPieces: this.pieceLimit_?.value,
      timeLimitMinutes: this.timeLimit_?.value,
    };
  }

  static fromJSON(json: { pieceLimitPieces?: number; timeLimitMinutes?: number }): ToolLifeProfile {
    if (json.pieceLimitPieces !== undefined && json.timeLimitMinutes !== undefined) {
      return ToolLifeProfile.ofBoth(json.pieceLimitPieces, json.timeLimitMinutes);
    }
    if (json.pieceLimitPieces !== undefined) return ToolLifeProfile.ofPieces(json.pieceLimitPieces);
    if (json.timeLimitMinutes !== undefined) return ToolLifeProfile.ofMinutes(json.timeLimitMinutes);
    return ToolLifeProfile.unknown();
  }
}
