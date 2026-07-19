import { ValidationError } from "../errors/validation-error";
import { Ico } from "../value-objects/ico";
import { Dic } from "../value-objects/dic";
import { Email } from "../value-objects/email";
import { Address } from "../value-objects/address";
import { EntityStav } from "./common";
import { ContactPerson, ContactPersonProps } from "./contact-person";

export interface CustomerProps {
  id: string;
  nazev: string;
  stav: EntityStav;
  ico?: Ico;
  dic?: Dic;
  fakturacniAdresa?: Address;
  dodaciAdresa?: Address;
  telefon?: string;
  email?: Email;
  poznamka?: string;
}

export type NewContactPersonInput = ContactPersonProps;

/** Zákazník vlastní kontaktní osoby (owned collection) - přidávají/mažou se jen
 *  přes tuhle třídu. Název firmy záměrně není primární klíč - identita je 'id'. */
export class Customer {
  private contactPersons: ContactPerson[] = [];

  private constructor(private props: CustomerProps) {}

  static create(props: CustomerProps): Customer {
    if (!props.nazev.trim()) throw new ValidationError("Customer: 'nazev' nesmí být prázdný.");
    return new Customer({ ...props });
  }

  /** Rekonstrukce z uloženého stavu (repozitář) včetně existujících kontaktů. */
  static restore(props: CustomerProps, contactPersons: ContactPerson[]): Customer {
    const customer = new Customer({ ...props });
    customer.contactPersons = [...contactPersons];
    return customer;
  }

  get id(): string {
    return this.props.id;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get ico(): Ico | undefined {
    return this.props.ico;
  }
  get dic(): Dic | undefined {
    return this.props.dic;
  }
  get fakturacniAdresa(): Address | undefined {
    return this.props.fakturacniAdresa;
  }
  get dodaciAdresa(): Address | undefined {
    return this.props.dodaciAdresa;
  }
  get telefon(): string | undefined {
    return this.props.telefon;
  }
  get email(): Email | undefined {
    return this.props.email;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get contacts(): readonly ContactPerson[] {
    return this.contactPersons;
  }

  rename(nazev: string): void {
    if (!nazev.trim()) throw new ValidationError("Customer: 'nazev' nesmí být prázdný.");
    this.props.nazev = nazev;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }

  addContact(input: NewContactPersonInput): ContactPerson {
    const contact = ContactPerson.create(input);
    this.contactPersons.push(contact);
    return contact;
  }

  removeContact(contactId: string): void {
    this.contactPersons = this.contactPersons.filter((c) => c.id !== contactId);
  }
}
