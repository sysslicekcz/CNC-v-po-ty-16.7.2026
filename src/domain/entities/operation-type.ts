import { ValidationError } from "../errors/validation-error";
import { EntityStav } from "./common";

/** Vysoká klasifikace pro shodu se strojem (MachineCapability) a pro odvození typu
 *  stroje. "preparation" (přípravné časy) je speciální - nekontroluje se proti
 *  capabilitám stroje, protože je dostupná na každém stroji (viz
 *  filterOperationsForMachine v dnešním lib/operations.ts). */
export type OperationCategory =
  | "turning"
  | "milling"
  | "grinding"
  | "cutting"
  | "inspection"
  | "ndt"
  | "preparation"
  | "other";

export interface OperationTypeProps {
  id: string;
  kod: string;
  nazev: string;
  kategorie: OperationCategory;
  stav: EntityStav;
  popis?: string;
}

/** Typ operace jako datový číselník, ne pevný enum - nový typ operace (např. nové
 *  broušení, nová NDT metoda) se přidá jako datový záznam, ne jako změna
 *  databázového schématu nebo kódu. */
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
  get stav(): EntityStav {
    return this.props.stav;
  }
  get popis(): string | undefined {
    return this.props.popis;
  }

  /** Kategorie "preparation" se nekontroluje proti MachineCapability - je dostupná
   *  na každém stroji bez ohledu na to, co umí. */
  get vyzadujeShoduSeStrojem(): boolean {
    return this.props.kategorie !== "preparation";
  }
}
