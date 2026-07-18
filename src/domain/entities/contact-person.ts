import { ValidationError } from "../errors/validation-error";
import { Email } from "../value-objects/email";

export interface ContactPersonProps {
  id: string;
  customerId: string;
  jmeno: string;
  pozice?: string;
  telefon?: string;
  email?: Email;
  poznamka?: string;
}

export type NewContactPersonInput = Omit<ContactPersonProps, "customerId">;

/** Kontaktní osoba - vnitřní entita agregátu Customer, nemá smysl bez zákazníka
 *  a nemodifikuje se mimo Customer.addContact()/removeContact(). */
export class ContactPerson {
  private constructor(private props: ContactPersonProps) {}

  static create(props: ContactPersonProps): ContactPerson {
    if (!props.jmeno.trim()) throw new ValidationError("ContactPerson: 'jmeno' nesmí být prázdné.");
    return new ContactPerson({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get jmeno(): string {
    return this.props.jmeno;
  }
  get pozice(): string | undefined {
    return this.props.pozice;
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
}
