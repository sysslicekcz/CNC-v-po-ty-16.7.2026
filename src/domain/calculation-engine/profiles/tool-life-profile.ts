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
    private readonly timeLimit_: ToolLife | undefined,
    /** Životnost v odebraném objemu (mm³, AP-MCE-001 Fáze E §8 "životnost v
     *  odebraném objemu" - brusný kotouč se opotřebovává objemem odebraného
     *  materiálu, ne (jen) počtem kusů/časem) - ADITIVNÍ TŘETÍ rozměr nad
     *  Fázi B (`undefined` pro všechny profily založené před Fází E, žádný
     *  stávající volající `ofPieces`/`ofMinutes`/`ofBoth`/`unknown` ho
     *  nenastavuje, chování Fáze C/D se nemění). Zůstává prostým číslem, ne
     *  `ToolLife` VO (ten má uzavřený `ToolLifeBasis` bez "volume", měnit
     *  Fázi A stavební kámen kvůli jedné fázi pozdější by bylo riskantnější
     *  než přidat nezávislý třetí rozměr sem). */
    private readonly volumeLimitMm3_: number | undefined = undefined
  ) {}

  static ofPieces(pieces: number, volumeLimitMm3?: number): ToolLifeProfile {
    return new ToolLifeProfile(ToolLife.ofPieces(pieces), undefined, volumeLimitMm3);
  }

  static ofMinutes(minutes: number, volumeLimitMm3?: number): ToolLifeProfile {
    return new ToolLifeProfile(undefined, ToolLife.ofMinutes(minutes), volumeLimitMm3);
  }

  static ofBoth(pieces: number, minutes: number, volumeLimitMm3?: number): ToolLifeProfile {
    return new ToolLifeProfile(ToolLife.ofPieces(pieces), ToolLife.ofMinutes(minutes), volumeLimitMm3);
  }

  /** AP-MCE-001 Fáze E §8 - životnost VÝHRADNĚ v odebraném objemu (typické
   *  pro brusné kotouče bez známého kusového/časového limitu). */
  static ofVolume(volumeLimitMm3: number): ToolLifeProfile {
    return new ToolLifeProfile(undefined, undefined, volumeLimitMm3);
  }

  static unknown(): ToolLifeProfile {
    return new ToolLifeProfile(undefined, undefined, undefined);
  }

  get pieceLimit(): ToolLife | undefined {
    return this.pieceLimit_;
  }

  get timeLimit(): ToolLife | undefined {
    return this.timeLimit_;
  }

  get volumeLimitMm3(): number | undefined {
    return this.volumeLimitMm3_;
  }

  get isUnknown(): boolean {
    return this.pieceLimit_ === undefined && this.timeLimit_ === undefined && this.volumeLimitMm3_ === undefined;
  }

  /**
   * Očekávaný počet výměn nástroje v dávce (AP-MCE-001 Fáze B §4: "výpočet
   * očekávaného počtu výměn nástroje"). Pokud jsou nastavené VÍC hranic,
   * rozhoduje ta PŘÍSNĚJŠÍ (vyšší počet výměn) - nástroj se vymění, jakmile
   * dosáhne KTERÉKOLIV ze svých životností. `estimatedUnitTimeMinutes` je
   * nutný jen pro vyhodnocení časové hranice, `removedVolumePerPieceMm3`
   * (AP-MCE-001 Fáze E §8) jen pro vyhodnocení objemové hranice - bez nich
   * se daná hranice přeskočí (0 výměn z ní), stejně jako u Fáze A
   * `ToolLife.plannedChangesForBatch` pro `"minutes"`/`"unlimited"`.
   */
  expectedToolChanges(quantity: number, estimatedUnitTimeMinutes?: number, removedVolumePerPieceMm3?: number): number {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ValidationError(`ToolLifeProfile: 'quantity' musí být kladné číslo, dostal jsem "${quantity}".`);
    }
    const byPieces = this.pieceLimit_ ? Math.ceil(quantity / this.pieceLimit_.value) : 0;
    const byTime =
      this.timeLimit_ && estimatedUnitTimeMinutes && estimatedUnitTimeMinutes > 0
        ? Math.ceil((quantity * estimatedUnitTimeMinutes) / this.timeLimit_.value)
        : 0;
    const byVolume =
      this.volumeLimitMm3_ && removedVolumePerPieceMm3 && removedVolumePerPieceMm3 > 0
        ? Math.ceil((quantity * removedVolumePerPieceMm3) / this.volumeLimitMm3_)
        : 0;
    return Math.max(byPieces, byTime, byVolume);
  }

  toJSON(): { pieceLimitPieces?: number; timeLimitMinutes?: number; volumeLimitMm3?: number } {
    return {
      pieceLimitPieces: this.pieceLimit_?.value,
      timeLimitMinutes: this.timeLimit_?.value,
      volumeLimitMm3: this.volumeLimitMm3_,
    };
  }

  static fromJSON(json: { pieceLimitPieces?: number; timeLimitMinutes?: number; volumeLimitMm3?: number }): ToolLifeProfile {
    if (json.pieceLimitPieces !== undefined && json.timeLimitMinutes !== undefined) {
      return ToolLifeProfile.ofBoth(json.pieceLimitPieces, json.timeLimitMinutes, json.volumeLimitMm3);
    }
    if (json.pieceLimitPieces !== undefined) return ToolLifeProfile.ofPieces(json.pieceLimitPieces, json.volumeLimitMm3);
    if (json.timeLimitMinutes !== undefined) return ToolLifeProfile.ofMinutes(json.timeLimitMinutes, json.volumeLimitMm3);
    if (json.volumeLimitMm3 !== undefined) return ToolLifeProfile.ofVolume(json.volumeLimitMm3);
    return ToolLifeProfile.unknown();
  }
}
