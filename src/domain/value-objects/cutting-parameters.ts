import { ValidationError } from "../errors/validation-error";

export interface CuttingParametersProps {
  vc?: number; // řezná rychlost [m/min]
  feed?: number; // posuv [mm/ot] nebo [mm/min] podle typu operace
  ap?: number; // hloubka řezu [mm]
}

/** Řezné podmínky nástroje - Vc/feed/ap patří vždy k sobě (odpovídají sloupcům
 *  s `fromTool: true` v lib/operations.ts, kde se stejné hodnoty jmenují Vc/f/ap -
 *  názvy se zachovávají při mapování na staré výpočtové řádky, doména ale používá
 *  čitelnější 'feed'). Ne všechny tři musí být vyplněné (např. vrtání nepoužívá ap). */
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
  get feed(): number | undefined {
    return this.props.feed;
  }
  get ap(): number | undefined {
    return this.props.ap;
  }

  /** Sloučí tenhle set s přepisy z `overrides` (nedefinovaná pole v overrides zůstanou
   *  beze změny) - použití: výchozí hodnoty nástroje -> override pro konkrétní stroj.
   *  Vždy vrací novou instanci, nikdy nemutuje `this` ani `overrides`. */
  mergedWith(overrides: CuttingParametersProps): CuttingParameters {
    return CuttingParameters.of({
      vc: overrides.vc ?? this.props.vc,
      feed: overrides.feed ?? this.props.feed,
      ap: overrides.ap ?? this.props.ap,
    });
  }

  toJSON(): CuttingParametersProps {
    return { ...this.props };
  }

  static fromJSON(json: CuttingParametersProps): CuttingParameters {
    return CuttingParameters.of(json);
  }
}
