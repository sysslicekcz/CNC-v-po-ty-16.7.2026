import { ValidationError } from "../errors/validation-error";
import { ExternalReference } from "../value-objects/external-reference";

export type OrderStav = "nova" | "v-reseni" | "hotovo" | "zrusena";

export interface OrderProps {
  id: string;
  customerId: string;
  cisloZakazky: string;
  nazev: string;
  stav: OrderStav;
  createdAt: number;
  externalErpId?: string;
  termin?: number;
  poznamka?: string;
  updatedAt?: number;
  externalRefs?: ExternalReference[];
}

/** Zakázka patří jednomu zákazníkovi (customerId, jen odkaz přes id - Customer je
 *  samostatný agregát). Záměrně nemá žádnou vazbu na Resource/Tool - ty jsou až
 *  na úrovni Operation uvnitř RoutingSheet. */
export class Order {
  private constructor(private props: OrderProps) {}

  static create(props: OrderProps): Order {
    if (!props.customerId.trim()) throw new ValidationError("Order: 'customerId' nesmí být prázdné.");
    if (!props.cisloZakazky.trim()) throw new ValidationError("Order: 'cisloZakazky' nesmí být prázdné.");
    if (!props.nazev.trim()) throw new ValidationError("Order: 'nazev' nesmí být prázdný.");
    return new Order({ ...props, externalRefs: props.externalRefs ?? [] });
  }

  static restore(props: OrderProps): Order {
    return new Order({ ...props, externalRefs: props.externalRefs ?? [] });
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
  get createdAt(): number {
    return this.props.createdAt;
  }
  get externalErpId(): string | undefined {
    return this.props.externalErpId;
  }
  get termin(): number | undefined {
    return this.props.termin;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get updatedAt(): number | undefined {
    return this.props.updatedAt;
  }
  get externalRefs(): readonly ExternalReference[] {
    return this.props.externalRefs ?? [];
  }

  setStav(stav: OrderStav, at: number): void {
    this.props.stav = stav;
    this.props.updatedAt = at;
  }
}
