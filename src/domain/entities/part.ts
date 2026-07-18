import { ValidationError } from "../errors/validation-error";
import { Quantity } from "../value-objects/quantity";
import { ExternalReference } from "../value-objects/external-reference";

export interface PartProps {
  id: string;
  orderId: string;
  nazev: string;
  mnozstvi: Quantity;
  cisloVykresu?: string;
  revizeVykresu?: string;
  material?: string;
  materialId?: string; // budoucí FK na Material - připraveno, dnes se nepoužívá
  polotovar?: string;
  poznamka?: string;
  dokumentaceRef?: string;
  externalRefs?: ExternalReference[];
}

/** Díl patří k zakázce (orderId, jen odkaz). Nesmí mít žádnou vazbu na stroj/zdroj -
 *  ta je až uvnitř RoutingSheet -> Operation. RoutingSheet je samostatný agregát
 *  odkazovaný přes partId, ne vnořená kolekce tady. */
export class Part {
  private constructor(private props: PartProps) {}

  static create(props: PartProps): Part {
    if (!props.orderId.trim()) throw new ValidationError("Part: 'orderId' nesmí být prázdné.");
    if (!props.nazev.trim()) throw new ValidationError("Part: 'nazev' nesmí být prázdný.");
    return new Part({ ...props, externalRefs: props.externalRefs ?? [] });
  }

  static restore(props: PartProps): Part {
    return new Part({ ...props, externalRefs: props.externalRefs ?? [] });
  }

  get id(): string {
    return this.props.id;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get mnozstvi(): Quantity {
    return this.props.mnozstvi;
  }
  get cisloVykresu(): string | undefined {
    return this.props.cisloVykresu;
  }
  get revizeVykresu(): string | undefined {
    return this.props.revizeVykresu;
  }
  get material(): string | undefined {
    return this.props.material;
  }
  get materialId(): string | undefined {
    return this.props.materialId;
  }
  get polotovar(): string | undefined {
    return this.props.polotovar;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get dokumentaceRef(): string | undefined {
    return this.props.dokumentaceRef;
  }
  get externalRefs(): readonly ExternalReference[] {
    return this.props.externalRefs ?? [];
  }

  /** Zobrazovací popisek - "číslo výkresu · název", nebo jen název bez čísla výkresu. */
  get label(): string {
    return this.props.cisloVykresu ? `${this.props.cisloVykresu} · ${this.props.nazev}` : this.props.nazev;
  }
}
