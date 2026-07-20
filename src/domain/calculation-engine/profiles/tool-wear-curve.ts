import { ValidationError } from "@/domain/errors/validation-error";

export interface ToolWearCurvePoint {
  /** Pořadí kusu v dávce (1-based). */
  pieceIndex: number;
  /** Multiplikátor `unitTime` v daném bodě (AP-MCE-001 Fáze A §03
   *  `ToolWearFactor(i)` - Fáze A ho zatím nahrazuje plochým
   *  `toolWearCoefficient`; tahle křivka je skutečná implementace toho
   *  odloženého TODO). */
  wearFactor: number;
}

/**
 * Křivka opotřebení nástroje v průběhu dávky (AP-MCE-001 Fáze B §4: "Wear
 * FactorCurve musí být deterministická a verzovaná"). Deterministická =
 * `factorAt(i)` je čistá funkce bodů křivky, žádná náhoda/čas/I-O. Verzovaná =
 * `curveVersion` je součástí každé instance a putuje do `CalculationResult`
 * stejně jako `ruleVersionId` (AP-MCE-001 Fáze A §15) - změna křivky je nová
 * verze, ne tichá úprava staré.
 */
export class ToolWearCurve {
  private readonly points: readonly ToolWearCurvePoint[];

  private constructor(
    points: ToolWearCurvePoint[],
    readonly curveVersion: string
  ) {
    this.points = Object.freeze([...points].sort((a, b) => a.pieceIndex - b.pieceIndex));
  }

  /** Konstantní křivka (žádné opotřebení v čase) - výchozí pro nástroje bez
   *  naměřených dat, ekvivalent Fáze A `toolWearCoefficient: 1`. */
  static flat(curveVersion = "flat-1"): ToolWearCurve {
    return new ToolWearCurve([{ pieceIndex: 1, wearFactor: 1 }], curveVersion);
  }

  static fromPoints(points: ToolWearCurvePoint[], curveVersion: string): ToolWearCurve {
    if (points.length === 0) throw new ValidationError("ToolWearCurve: potřebuje aspoň jeden bod.");
    for (const point of points) {
      if (!Number.isFinite(point.wearFactor) || point.wearFactor <= 0) {
        throw new ValidationError(`ToolWearCurve: 'wearFactor' musí být kladné číslo, dostal jsem "${point.wearFactor}".`);
      }
      if (!Number.isInteger(point.pieceIndex) || point.pieceIndex < 1) {
        throw new ValidationError(`ToolWearCurve: 'pieceIndex' musí být kladné celé číslo, dostal jsem "${point.pieceIndex}".`);
      }
    }
    if (!curveVersion.trim()) throw new ValidationError("ToolWearCurve: 'curveVersion' nesmí být prázdná.");
    return new ToolWearCurve(points, curveVersion);
  }

  /** Lineární interpolace mezi definovanými body; před prvním/za posledním
   *  bodem se hodnota drží konstantní (žádná extrapolace). Deterministické -
   *  stejný `pieceIndex` vždy dá stejný výsledek. */
  factorAt(pieceIndex: number): number {
    if (!Number.isInteger(pieceIndex) || pieceIndex < 1) {
      throw new ValidationError(`ToolWearCurve.factorAt: 'pieceIndex' musí být kladné celé číslo, dostal jsem "${pieceIndex}".`);
    }
    if (pieceIndex <= this.points[0].pieceIndex) return this.points[0].wearFactor;
    const last = this.points[this.points.length - 1];
    if (pieceIndex >= last.pieceIndex) return last.wearFactor;

    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      if (pieceIndex >= a.pieceIndex && pieceIndex <= b.pieceIndex) {
        const ratio = (pieceIndex - a.pieceIndex) / (b.pieceIndex - a.pieceIndex);
        return a.wearFactor + ratio * (b.wearFactor - a.wearFactor);
      }
    }
    return last.wearFactor;
  }

  toJSON(): { points: ToolWearCurvePoint[]; curveVersion: string } {
    return { points: [...this.points], curveVersion: this.curveVersion };
  }

  static fromJSON(json: { points: ToolWearCurvePoint[]; curveVersion: string }): ToolWearCurve {
    return ToolWearCurve.fromPoints(json.points, json.curveVersion);
  }
}
