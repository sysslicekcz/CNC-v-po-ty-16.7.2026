import { ValidationError } from "../errors/validation-error";

export interface AddressProps {
  ulice?: string;
  mesto: string;
  psc?: string;
  zeme: string;
}

/** Fakturační/dodací adresa. Jen mesto a zeme jsou povinné - ulice/psc se hodí
 *  u některých zahraničních adres vynechat, nemá smysl to vynucovat. */
export class Address {
  private constructor(private readonly props: AddressProps) {}

  static of(props: AddressProps): Address {
    if (!props.mesto.trim()) throw new ValidationError("Address: 'mesto' nesmí být prázdné.");
    if (!props.zeme.trim()) throw new ValidationError("Address: 'zeme' nesmí být prázdné.");
    return new Address({ ...props });
  }

  get ulice(): string | undefined {
    return this.props.ulice;
  }
  get mesto(): string {
    return this.props.mesto;
  }
  get psc(): string | undefined {
    return this.props.psc;
  }
  get zeme(): string {
    return this.props.zeme;
  }

  toString(): string {
    const ulicePsc = [this.props.ulice, this.props.psc].filter(Boolean).join(", ");
    return [ulicePsc, this.props.mesto, this.props.zeme].filter(Boolean).join(", ");
  }

  toJSON(): AddressProps {
    return { ...this.props };
  }

  static fromJSON(json: AddressProps): Address {
    return Address.of(json);
  }
}
