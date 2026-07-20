import { ValidationError } from "@/domain/errors/validation-error";

/**
 * Pracovní prostor/maximální rozměr dílu stroje (AP-MCE-001 Fáze B §3) -
 * STEJNÝ tvar pro `MachineProfile.workEnvelope` (fyzický rozsah stroje) i
 * `maxPartDimensions` (prakticky použitelný maximální díl, může být menší
 * kvůli upnutí/zásobníku) - dvě odlišná POUŽITÍ stejné struktury, ne dvě
 * odlišné třídy.
 */
export interface MachineWorkEnvelopeProps {
  maxLengthMm?: number;
  maxWidthMm?: number;
  maxHeightMm?: number;
  /** Relevantní hlavně pro soustruhy (max. průměr přes suport/nad ložem). */
  maxDiameterMm?: number;
}

export class MachineWorkEnvelope {
  private readonly props: Readonly<MachineWorkEnvelopeProps>;

  private constructor(props: MachineWorkEnvelopeProps) {
    this.props = Object.freeze({ ...props });
  }

  static create(props: MachineWorkEnvelopeProps): MachineWorkEnvelope {
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new ValidationError(`MachineWorkEnvelope: '${key}' musí být kladné číslo, dostal jsem "${value}".`);
      }
    }
    return new MachineWorkEnvelope(props);
  }

  get maxLengthMm(): number | undefined {
    return this.props.maxLengthMm;
  }
  get maxWidthMm(): number | undefined {
    return this.props.maxWidthMm;
  }
  get maxHeightMm(): number | undefined {
    return this.props.maxHeightMm;
  }
  get maxDiameterMm(): number | undefined {
    return this.props.maxDiameterMm;
  }

  /** `true`, pokud PROKAZATELNĚ (aspoň jeden rozměr, kde to lze porovnat)
   *  díl nevejde do tohohle prostoru - chybějící rozměr na kterékoliv straně
   *  se nevyhodnocuje jako překročení (nedostatek dat, ne chyba). */
  exceededBy(part: MachineWorkEnvelopeProps): boolean {
    const exceeds = (limit: number | undefined, requested: number | undefined) =>
      limit !== undefined && requested !== undefined && requested > limit;
    return (
      exceeds(this.props.maxLengthMm, part.maxLengthMm) ||
      exceeds(this.props.maxWidthMm, part.maxWidthMm) ||
      exceeds(this.props.maxHeightMm, part.maxHeightMm) ||
      exceeds(this.props.maxDiameterMm, part.maxDiameterMm)
    );
  }

  toJSON(): MachineWorkEnvelopeProps {
    return { ...this.props };
  }

  static fromJSON(json: MachineWorkEnvelopeProps): MachineWorkEnvelope {
    return MachineWorkEnvelope.create(json);
  }
}
