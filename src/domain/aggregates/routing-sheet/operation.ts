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
  technologickaPoznamka?: string;
}

export interface NewOperationInput {
  id: string;
  nazev: string;
  machineId?: string;
  technologickaPoznamka?: string;
}

/** Technologický krok postupu - vnořená entita agregátu RoutingSheet, nenese
 *  odkaz zpátky na RoutingSheet (vztah je dán vnořením, ne FK). Nenese nástroj ani
 *  jednotný typ operace přímo - to je na Activity (jedna operace může mít víc
 *  upnutí, jedno upnutí víc činností s různými nástroji). Přiřazena je maximálně
 *  jednomu stroji (machineId) - viz zadání Krok 2, "Operace je přiřazena maximálně
 *  jednomu stroji." */
export class Operation {
  private positions: Position[] = [];

  private constructor(private props: OperationProps) {}

  static create(props: OperationProps): Operation {
    if (!props.nazev.trim()) throw new ValidationError("Operation: 'nazev' nesmí být prázdný.");
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
  get technologickaPoznamka(): string | undefined {
    return this.props.technologickaPoznamka;
  }
  get positionList(): readonly Position[] {
    return this.positions;
  }

  /** Součet finalTime všech Activity ve všech upnutích - odvozená hodnota, nikdy
   *  se neukládá ručně. */
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

  /** "Hloupý" setter - shodu stroje s typy operací existujících Activity hlídá
   *  use case v Application vrstvě přes MachineCapabilityRepository (Operation
   *  nesmí sama volat repozitáře). */
  assignMachine(machineId: string | undefined): void {
    this.props.machineId = machineId;
  }

  getPosition(positionId: string): Position {
    const position = this.positions.find((p) => p.id === positionId);
    if (!position) throw new NotFoundError("Position", positionId);
    return position;
  }

  addPosition(input: NewPositionInput): Position {
    const position = Position.create({ id: input.id, nazev: input.nazev });
    this.positions.push(position);
    return position;
  }

  removePosition(positionId: string): void {
    if (!this.positions.some((p) => p.id === positionId)) {
      throw new NotFoundError("Position", positionId);
    }
    this.positions = this.positions.filter((p) => p.id !== positionId);
  }
}
