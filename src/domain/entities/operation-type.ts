import { ValidationError } from "../errors/validation-error";

/** Vysoká klasifikace pro shodu se strojem (ResourceCapability) a pro odvození typu
 *  stroje. "Preparation" (přípravné časy) je speciální - nekontroluje se proti
 *  capabilitám zdroje, protože je dostupná na každém stroji (viz filterOperationsForMachine
 *  v dnešním operations.ts). */
export type OperationCategory =
  | "Turning"
  | "Milling"
  | "Grinding"
  | "Cutting"
  | "Inspection"
  | "NDT"
  | "Preparation"
  | "Other";

export type EntityStav = "aktivni" | "neaktivni";

export interface OperationTypeProps {
  id: string;
  kod: string;
  nazev: string;
  kategorie: OperationCategory;
  popis?: string;
  stav: EntityStav;
}

/** Typ operace jako číselníková entita, ne enum - nový typ operace (např. nové
 *  broušení, nová NDT metoda) se přidá jako datový záznam, ne jako změna kódu. */
export class OperationType {
  private constructor(private readonly props: OperationTypeProps) {}

  static create(props: OperationTypeProps): OperationType {
    if (!props.id.trim()) throw new ValidationError("OperationType: 'id' nesmí být prázdné.");
    if (!props.kod.trim()) throw new ValidationError("OperationType: 'kod' nesmí být prázdný.");
    if (!props.nazev.trim()) throw new ValidationError("OperationType: 'nazev' nesmí být prázdný.");
    return new OperationType({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get kod(): string {
    return this.props.kod;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get kategorie(): OperationCategory {
    return this.props.kategorie;
  }
  get popis(): string | undefined {
    return this.props.popis;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }

  /** Kategorie Preparation se nekontroluje proti ResourceCapability - je dostupná
   *  na každém zdroji bez ohledu na to, co umí. */
  get vyzadujeShoduSeZdrojem(): boolean {
    return this.props.kategorie !== "Preparation";
  }
}
