import { ValidationError } from "../errors/validation-error";

export interface AddressProps {
  ulice: string;
  mesto: string;
  psc: string;
  zeme: string;
}

/** Fakturační/dodací adresa. Pokud entita adresu má, musí být kompletní - "napůl vyplněná"
 *  adresa by na faktuře/dokladu stejně nebyla použitelná. */
export class Address {
  private constructor(private readonly props: AddressProps) {}

  static of(props: AddressProps): Address {
    for (const [key, value] of Object.entries(props)) {
      if (!value || !value.trim()) {
        throw new ValidationError(`Adresa: pole "${key}" nesmí být prázdné.`);
      }
    }
    return new Address({ ...props });
  }

  get ulice(): string {
    return this.props.ulice;
  }
  get mesto(): string {
    return this.props.mesto;
  }
  get psc(): string {
    return this.props.psc;
  }
  get zeme(): string {
    return this.props.zeme;
  }

  toString(): string {
    return `${this.props.ulice}, ${this.props.psc} ${this.props.mesto}, ${this.props.zeme}`;
  }
}
