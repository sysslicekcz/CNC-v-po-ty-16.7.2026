import { ValidationError } from "../errors/validation-error";
import { Email } from "../value-objects/email";

export interface ContactPersonProps {
  id: string;
  jmeno: string;
  pozice?: string;
  telefon?: string;
  email?: Email;
  poznamka?: string;
}

/** Kontaktní osoba - vnořená (owned) entita v rámci agregátu Customer, nemá
 *  smysl bez zákazníka. Nenese customerId - vztah je dán tím, že je uložená
 *  přímo v Customer.contacts, ne samostatnou FK vazbou. */
export class ContactPerson {
  private constructor(private readonly props: ContactPersonProps) {}

  static create(props: ContactPersonProps): ContactPerson {
    if (!props.jmeno.trim()) throw new ValidationError("ContactPerson: 'jmeno' nesmí být prázdné.");
    return new ContactPerson({ ...props });
  }

  get id(): string {
    return this.props.id;
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
