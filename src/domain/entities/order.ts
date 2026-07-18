import { ValidationError } from "../errors/validation-error";

export type OrderStav = "nova" | "v-reseni" | "hotovo" | "zrusena";

export interface OrderProps {
  id: string;
  customerId: string;
  cisloZakazky: string;
  nazev: string;
  stav: OrderStav;
  termin?: number;
  poznamka?: string;
  createdAt: number;
  updatedAt?: number;
}

/** Zakázka patří jednomu zákazníkovi (customerId, jen odkaz - Customer je vlastní
 *  agregát). Nemá žádnou vazbu na Machine/Tool - ta je až na úrovni Operation uvnitř
 *  RoutingSheet. */
export class Order {
  private constructor(private props: OrderProps) {}

  static create(props: OrderProps): Order {
    if (!props.customerId.trim()) throw new ValidationError("Order: 'customerId' nesmí být prázdné.");
    if (!props.cisloZakazky.trim()) throw new ValidationError("Order: 'cisloZakazky' nesmí být prázdné.");
    if (!props.nazev.trim()) throw new ValidationError("Order: 'nazev' nesmí být prázdný.");
    return new Order({ ...props });
  }

  static restore(props: OrderProps): Order {
    return new Order({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get cisloZakazky(): string {
    return this.props.cisloZakazky;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get stav(): OrderStav {
    return this.props.stav;
  }
  get termin(): number | undefined {
    return this.props.termin;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get createdAt(): number {
    return this.props.createdAt;
  }
  get updatedAt(): number | undefined {
    return this.props.updatedAt;
  }

  setStav(stav: OrderStav, at: number): void {
    this.props.stav = stav;
    this.props.updatedAt = at;
  }
}
