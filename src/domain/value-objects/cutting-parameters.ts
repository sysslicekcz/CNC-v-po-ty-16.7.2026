import { ValidationError } from "../errors/validation-error";

export interface CuttingParametersProps {
  vc?: number; // řezná rychlost [m/min]
  f?: number; // posuv [mm/ot] nebo [mm/min] dle typu operace
  ap?: number; // hloubka řezu [mm]
}

/** Řezné podmínky nástroje - Vc/f/ap patří vždy k sobě (viz sloupce s `fromTool: true`
 *  v operations.ts), tak ať se drží pohromadě na jednom místě místo tří rozházených čísel.
 *  Ne všechny tři musí být vyplněné (např. vrtání nepoužívá ap). */
export class CuttingParameters {
  private constructor(private readonly props: CuttingParametersProps) {}

  static of(props: CuttingParametersProps): CuttingParameters {
    for (const [key, value] of Object.entries(props)) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new ValidationError(`Řezný parametr "${key}" nesmí být záporný, dostal jsem "${value}".`);
      }
    }
    return new CuttingParameters({ ...props });
  }

  get vc(): number | undefined {
    return this.props.vc;
  }
  get f(): number | undefined {
    return this.props.f;
  }
  get ap(): number | undefined {
    return this.props.ap;
  }

  /** Sloučí tenhle set s přepisy z `overrides` (nedefinovaná pole v overrides zůstanou beze změny) -
   *  použití: výchozí hodnoty nástroje -> override pro konkrétní stroj. */
  mergedWith(overrides: CuttingParametersProps): CuttingParameters {
    return CuttingParameters.of({
      vc: overrides.vc ?? this.props.vc,
      f: overrides.f ?? this.props.f,
      ap: overrides.ap ?? this.props.ap,
    });
  }
}
