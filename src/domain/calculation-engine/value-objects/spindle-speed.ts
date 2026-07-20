import { ValidationError } from "@/domain/errors/validation-error";
import { CuttingSpeed } from "./cutting-speed";
import { Diameter } from "./diameter";

/**
 * Otáčky vřetena (rpm) - AP-MCE-001 §18 vyžaduje "rpm > 0" a "nesmyslné
 * otáčky"/"překročení výkonu stroje" jako blokující/varovné stavy. Tenhle
 * hodnotový objekt nese jen samotné otáčky a jejich odvození z řezné
 * rychlosti a průměru; porovnání s `Machine.maxRpm` (MachineLimitError) dělá
 * až volající strategie/use case, který zná konkrétní `MachineProfile`
 * (ten v Fázi A ještě neexistuje - viz `MachineLimitError`).
 */
export class SpindleSpeed {
  private constructor(private readonly rpm_: number) {}

  static ofRpm(rpm: number): SpindleSpeed {
    if (!Number.isFinite(rpm) || rpm <= 0) {
      throw new ValidationError(`Otáčky musí být kladné číslo, dostal jsem "${rpm}" rpm.`);
    }
    return new SpindleSpeed(rpm);
  }

  /** n = (Vc * 1000) / (π * D) - základní technologický vzorec (AP-MCE-001,
   *  §05) pro odvození otáček z řezné rychlosti a průměru obrobku/nástroje. */
  static fromCuttingSpeed(cuttingSpeed: CuttingSpeed, diameter: Diameter): SpindleSpeed {
    const rpm = (cuttingSpeed.metersPerMinute * 1000) / (Math.PI * diameter.millimeters);
    return SpindleSpeed.ofRpm(rpm);
  }

  get rpm(): number {
    return this.rpm_;
  }

  /** Opačný směr - řezná rychlost, kterou tyhle otáčky dávají na daném
   *  průměru (užitečné pro "Porovnání strojů/nástrojů", AP-MCE-001 §20). */
  cuttingSpeedAt(diameter: Diameter): CuttingSpeed {
    return CuttingSpeed.ofMetersPerMinute((this.rpm_ * Math.PI * diameter.millimeters) / 1000);
  }

  toString(): string {
    return `${Math.round(this.rpm_)} min⁻¹`;
  }

  toJSON(): number {
    return this.rpm_;
  }

  static fromJSON(rpm: number): SpindleSpeed {
    return SpindleSpeed.ofRpm(rpm);
  }
}
