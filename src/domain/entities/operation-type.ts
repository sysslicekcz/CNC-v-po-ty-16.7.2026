import { ValidationError } from "../errors/validation-error";
import { EntityStav } from "./common";

/** Vysoká klasifikace pro shodu se strojem (MachineCapability) a pro odvození typu
 *  stroje. "preparation" (přípravné časy) je speciální - nekontroluje se proti
 *  capabilitám stroje, protože je dostupná na každém stroji (viz
 *  filterOperationsForMachine v dnešním lib/operations.ts).
 *
 * "manual" doplněno v AP-MCE-001 Fázi A/B (Manufacturing Calculation Engine) -
 * ruční operace (odjehlení, čištění, balení, ...) jsou explicitně součástí
 * MVP rozsahu (`ManualOperationCalculationStrategy`), ale tenhle číselník pro
 * ně dosud neměl vlastní hodnotu (dřív by musely spadat pod "other", což by
 * ztratilo význam). Stejná mezera jako `ExternalReferenceEntityType` bez
 * `"material"` před Fází B - doplnění, ne architektonická změna. */
export type OperationCategory =
  | "turning"
  | "milling"
  | "grinding"
  | "cutting"
  | "inspection"
  | "ndt"
  | "preparation"
  | "manual"
  | "other";

/** Jaký druh zdroje operace tohoto typu potřebuje (Krok 5, zadání bod 12) -
 *  editor postupu tohle pole v tomto kroku ještě nevynucuje (zůstává na
 *  technologovi, viz docs/step-5/known-limitations.md), je to připravený
 *  podklad pro budoucí filtrování zdrojů podle typu operace. */
export type OperationTypeResourceRequirement = "machine" | "external" | "either" | "none";

export interface OperationTypeProps {
  id: string;
  /** Krok 5 - `OperationType` se poprvé stává uživatelsky editovatelným
   *  kmenovým záznamem (dřív jen seedovaný číselník), tenant scope je proto
   *  nutný (viz docs/audits/step-5-audit.md, riziko migrace č. 1). */
  tenantId: string;
  kod: string;
  nazev: string;
  kategorie: OperationCategory;
  resourceRequirement: OperationTypeResourceRequirement;
  requiresSetupTime: boolean;
  requiresUnitTime: boolean;
  stav: EntityStav;
  popis?: string;
}

/** Typ operace jako datový číselník, ne pevný enum - nový typ operace (např. nové
 *  broušení, nová NDT metoda) se přidá jako datový záznam, ne jako změna
 *  databázového schématu nebo kódu. */
export class OperationType {
  private constructor(private props: OperationTypeProps) {}

  static create(props: OperationTypeProps): OperationType {
    if (!props.tenantId.trim()) throw new ValidationError("OperationType: 'tenantId' nesmí být prázdné.");
    if (!props.id.trim()) throw new ValidationError("OperationType: 'id' nesmí být prázdné.");
    if (!props.kod.trim()) throw new ValidationError("OperationType: 'kod' nesmí být prázdný.");
    if (!props.nazev.trim()) throw new ValidationError("OperationType: 'nazev' nesmí být prázdný.");
    return new OperationType({ ...props });
  }

  static restore(props: OperationTypeProps): OperationType {
    return new OperationType({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
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
  get resourceRequirement(): OperationTypeResourceRequirement {
    return this.props.resourceRequirement;
  }
  get requiresSetupTime(): boolean {
    return this.props.requiresSetupTime;
  }
  get requiresUnitTime(): boolean {
    return this.props.requiresUnitTime;
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

  rename(nazev: string): void {
    if (!nazev.trim()) throw new ValidationError("OperationType: 'nazev' nesmí být prázdný.");
    this.props.nazev = nazev;
  }

  changeCode(kod: string): void {
    if (!kod.trim()) throw new ValidationError("OperationType: 'kod' nesmí být prázdný.");
    this.props.kod = kod;
  }

  updateDetails(input: {
    kategorie?: OperationCategory;
    resourceRequirement?: OperationTypeResourceRequirement;
    requiresSetupTime?: boolean;
    requiresUnitTime?: boolean;
    popis?: string;
  }): void {
    if (input.kategorie !== undefined) this.props.kategorie = input.kategorie;
    if (input.resourceRequirement !== undefined) this.props.resourceRequirement = input.resourceRequirement;
    if (input.requiresSetupTime !== undefined) this.props.requiresSetupTime = input.requiresSetupTime;
    if (input.requiresUnitTime !== undefined) this.props.requiresUnitTime = input.requiresUnitTime;
    if (input.popis !== undefined) this.props.popis = input.popis || undefined;
  }

  setStav(stav: EntityStav): void {
    this.props.stav = stav;
  }
}
