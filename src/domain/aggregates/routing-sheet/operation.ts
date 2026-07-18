import { ValidationError } from "../../errors/validation-error";
import { NotFoundError } from "../../errors/not-found-error";
import { SortKey } from "../../value-objects/sort-key";
import { OperationNumber } from "../../value-objects/operation-number";
import { EntityStav } from "../../entities/common";
import { Position, NewPositionInput } from "./position";

export interface OperationProps {
  id: string;
  operationNumber: OperationNumber;
  sortKey: SortKey;
  nazev: string;
  stav: EntityStav;
  machineId?: string;
  /** Kooperace (ExternalOperationResource.id) - viz `OperationResourceAssignment`
   *  (Krok 4, zadání bod 6). Operace nikdy nemá vyplněné `machineId` i
   *  `externalResourceId` současně - `assignMachine`/`assignExternalResource`
   *  se navzájem čistí, aby nemohl vzniknout neplatný mezistav. */
  externalResourceId?: string;
  technologickaPoznamka?: string;
  /** Manuální/souhrnný čas operace (Krok 4, zadání bod 21) - obdoba
   *  `Calculation.manualCorrection`, ale na úrovni celé operace. NENÍ náhrada
   *  za odvozené `Operation.finalTime` (součet Activity.calculation.finalTime) -
   *  slouží hlavně operacím bez rozpadu na Activity/Calculation (kooperace,
   *  ruční operace), kde žádný jiný zdroj času neexistuje. */
  setupTimeMinutes?: number;
  unitTimeMinutes?: number;
  transferBatchSize?: number;
}

export interface NewOperationInput {
  id: string;
  nazev: string;
  machineId?: string;
  externalResourceId?: string;
  technologickaPoznamka?: string;
}

/** Diskriminovaná unie přiřazení zdroje (Krok 4, zadání bod 6) - odvozená z
 *  `Operation.machineId`/`externalResourceId`, ne samostatně uložený stav.
 *  Stroj a kooperace jsou záměrně rozdílné varianty, ne jeden nekontrolovaný
 *  `resourceId` - viz docs/adr/routing-operation-resource-assignment.md. */
export type OperationResourceAssignment =
  | { type: "machine"; machineId: string }
  | { type: "external"; externalResourceId: string }
  | { type: "unassigned" };

function validateTimeMinutes(value: number | undefined, field: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`Operation: '${field}' musí být nezáporné konečné číslo.`);
  }
}

/** Technologický krok postupu - vnořená entita agregátu RoutingSheet, nenese
 *  odkaz zpátky na RoutingSheet (vztah je dán vnořením, ne FK). Nenese nástroj ani
 *  jednotný typ operace přímo - to je na Activity (jedna operace může mít víc
 *  upnutí, jedno upnutí víc činností s různými nástroji). Přiřazena je maximálně
 *  jednomu zdroji (stroj NEBO kooperace, nikdy oboje) - viz zadání Krok 2, "Operace
 *  je přiřazena maximálně jednomu stroji" rozšířené v Kroku 4 o kooperaci. */
export class Operation {
  private positions: Position[] = [];

  private constructor(private props: OperationProps) {}

  static create(props: OperationProps): Operation {
    if (!props.nazev.trim()) throw new ValidationError("Operation: 'nazev' nesmí být prázdný.");
    if (props.machineId && props.externalResourceId) {
      throw new ValidationError("Operation: nelze současně přiřadit stroj i kooperaci.");
    }
    validateTimeMinutes(props.setupTimeMinutes, "setupTimeMinutes");
    validateTimeMinutes(props.unitTimeMinutes, "unitTimeMinutes");
    validateTimeMinutes(props.transferBatchSize, "transferBatchSize");
    return new Operation({ ...props });
  }

  static restore(props: OperationProps, positions: Position[]): Operation {
    const operation = new Operation({ ...props });
    operation.positions = [...positions];
    return operation;
  }

  get id(): string {
    return this.props.id;
  }
  get operationNumber(): OperationNumber {
    return this.props.operationNumber;
  }
  get sortKey(): SortKey {
    return this.props.sortKey;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get machineId(): string | undefined {
    return this.props.machineId;
  }
  get externalResourceId(): string | undefined {
    return this.props.externalResourceId;
  }
  get technologickaPoznamka(): string | undefined {
    return this.props.technologickaPoznamka;
  }
  get setupTimeMinutes(): number | undefined {
    return this.props.setupTimeMinutes;
  }
  get unitTimeMinutes(): number | undefined {
    return this.props.unitTimeMinutes;
  }
  get transferBatchSize(): number | undefined {
    return this.props.transferBatchSize;
  }
  /** Seřazené podle sortKey. Legacy upnutí bez sortKey (migrovaná před Krokem 4,
   *  viz Position.sortKey) se řadí až za ta se sortKey - deterministické, i když
   *  ne nutně "hezké" pořadí, dokud je uživatel poprvé nepřeuspořádá (tím dostanou
   *  sortKey taky). */
  get positionList(): readonly Position[] {
    return [...this.positions].sort((a, b) => {
      if (a.sortKey && b.sortKey) return a.sortKey.compareTo(b.sortKey);
      if (a.sortKey) return -1;
      if (b.sortKey) return 1;
      return 0;
    });
  }

  /** Odvozené z `machineId`/`externalResourceId` - nikdy samostatně uložený stav. */
  get resourceAssignment(): OperationResourceAssignment {
    if (this.props.machineId) return { type: "machine", machineId: this.props.machineId };
    if (this.props.externalResourceId) return { type: "external", externalResourceId: this.props.externalResourceId };
    return { type: "unassigned" };
  }

  /** Součet finalTime všech Activity ve všech upnutích - odvozená hodnota, nikdy
   *  se neukládá ručně. Nezahrnuje manuální `setupTimeMinutes`/`unitTimeMinutes` -
   *  ty jsou samostatná, explicitně zadaná hodnota (viz OperationProps). */
  get finalTime(): number {
    return this.positions.reduce(
      (sum, position) => sum + position.activityList.reduce((s, a) => s + (a.calculation?.finalTime ?? 0), 0),
      0
    );
  }

  /** Přečíslování (OperationNumber) - čistě zobrazovací, nikdy nemění sortKey. */
  setOperationNumber(operationNumber: OperationNumber): void {
    this.props.operationNumber = operationNumber;
  }

  setSortKey(sortKey: SortKey): void {
    this.props.sortKey = sortKey;
  }

  rename(nazev: string): void {
    if (!nazev.trim()) throw new ValidationError("Operation: 'nazev' nesmí být prázdný.");
    this.props.nazev = nazev;
  }

  setNote(technologickaPoznamka: string | undefined): void {
    this.props.technologickaPoznamka = technologickaPoznamka;
  }

  setTimes(input: { setupTimeMinutes?: number; unitTimeMinutes?: number }): void {
    validateTimeMinutes(input.setupTimeMinutes, "setupTimeMinutes");
    validateTimeMinutes(input.unitTimeMinutes, "unitTimeMinutes");
    this.props.setupTimeMinutes = input.setupTimeMinutes;
    this.props.unitTimeMinutes = input.unitTimeMinutes;
  }

  setTransferBatchSize(transferBatchSize: number | undefined): void {
    validateTimeMinutes(transferBatchSize, "transferBatchSize");
    this.props.transferBatchSize = transferBatchSize;
  }

  /** "Hloupý" setter - shodu stroje s typy operací existujících Activity hlídá
   *  use case v Application vrstvě přes MachineCapabilityRepository (Operation
   *  nesmí sama volat repozitáře). Nastavení skutečného id vždy vyčistí
   *  `externalResourceId` (mutual exclusivity, viz OperationResourceAssignment). */
  assignMachine(machineId: string | undefined): void {
    this.props.machineId = machineId;
    if (machineId) this.props.externalResourceId = undefined;
  }

  /** Symetrické k `assignMachine` - nastavení skutečného id vždy vyčistí `machineId`. */
  assignExternalResource(externalResourceId: string | undefined): void {
    this.props.externalResourceId = externalResourceId;
    if (externalResourceId) this.props.machineId = undefined;
  }

  getPosition(positionId: string): Position {
    const position = this.positions.find((p) => p.id === positionId);
    if (!position) throw new NotFoundError("Position", positionId);
    return position;
  }

  addPosition(input: NewPositionInput): Position {
    const sorted = this.positionList;
    const lastPosition = sorted[sorted.length - 1];
    const position = Position.create({
      id: input.id,
      nazev: input.nazev,
      sortKey: SortKey.between(lastPosition?.sortKey ?? null, null),
    });
    this.positions.push(position);
    return position;
  }

  /** Přesune existující Position za `afterPositionId` (null = na začátek) -
   *  analogické k `Position.moveActivity`. */
  movePosition(positionId: string, afterPositionId: string | null): void {
    const sorted = this.positionList;
    const moving = sorted.find((p) => p.id === positionId);
    if (!moving) throw new NotFoundError("Position", positionId);
    const rest = sorted.filter((p) => p.id !== positionId);
    const afterIndex = afterPositionId ? rest.findIndex((p) => p.id === afterPositionId) : -1;
    if (afterPositionId && afterIndex === -1) throw new NotFoundError("Position", afterPositionId);
    const prev = afterIndex >= 0 ? rest[afterIndex] : null;
    const next = afterIndex >= 0 ? (rest[afterIndex + 1] ?? null) : (rest[0] ?? null);
    moving.setSortKey(SortKey.between(prev?.sortKey ?? null, next?.sortKey ?? null));
  }

  removePosition(positionId: string): void {
    if (!this.positions.some((p) => p.id === positionId)) {
      throw new NotFoundError("Position", positionId);
    }
    this.positions = this.positions.filter((p) => p.id !== positionId);
  }
}
