import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Řezná rychlost (Vc) v m/min - stejná fyzikální veličina jako `vc` v
 * existujícím `domain/value-objects/cutting-parameters.ts`, ale tady jako
 * samostatný, validovaný hodnotový objekt s vlastní aritmetikou (odvození
 * otáček, viz `SpindleSpeed.fromCuttingSpeed`). `CuttingParameters` se
 * nerozšiřuje ani nemění - Manufacturing Calculation Engine nad ní jen staví
 * (Turning/Milling strategie v pozdější fázi z ní `CuttingSpeed` sestaví).
 */
export class CuttingSpeed {
  private constructor(private readonly metersPerMinute_: number) {}

  static ofMetersPerMinute(metersPerMinute: number): CuttingSpeed {
    if (!Number.isFinite(metersPerMinute) || metersPerMinute < 0) {
      throw new ValidationError(`Řezná rychlost nesmí být záporná, dostal jsem "${metersPerMinute}" m/min.`);
    }
    return new CuttingSpeed(metersPerMinute);
  }

  get metersPerMinute(): number {
    return this.metersPerMinute_;
  }

  toString(): string {
    return `${this.metersPerMinute_} m/min`;
  }

  toJSON(): number {
    return this.metersPerMinute_;
  }

  static fromJSON(metersPerMinute: number): CuttingSpeed {
    return CuttingSpeed.ofMetersPerMinute(metersPerMinute);
  }
}
