import { ValidationError } from "../errors/validation-error";
import { NotFoundError } from "../errors/not-found-error";
import { SortKey } from "../value-objects/sort-key";
import { EntityStav } from "./operation-type";
import { Position, NewPositionInput } from "./position";

export interface OperationProps {
  id: string;
  routingSheetId: string;
  operationNumber: number;
  sortKey: SortKey;
  nazev: string;
  stav: EntityStav;
  resourceId?: string;
  technologickaPoznamka?: string;
}

export interface NewOperationInput {
  id: string;
  nazev: string;
  resourceId?: string;
  technologickaPoznamka?: string;
}

/** Technologický krok postupu - vnitřní entita agregátu RoutingSheet. Nenese
 *  nástroj ani jednotný typ operace přímo (to je na Activity, viz report v2) -
 *  jen přiřazený zdroj (resourceId) a sdružuje upnutí (Position). */
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
  get routingSheetId(): string {
    return this.props.routingSheetId;
  }
  get operationNumber(): number {
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
  get resourceId(): string | undefined {
    return this.props.resourceId;
  }
  get technologickaPoznamka(): string | undefined {
    return this.props.technologickaPoznamka;
  }
  get positionList(): readonly Position[] {
    return this.positions;
  }

  /** Součet finalTime všech Activity ve všech upnutích - odvozená hodnota, nikdy
   *  se neukládá ručně (viz report). */
  get finalTime(): number {
    return this.positions.reduce(
      (sum, position) => sum + position.activityList.reduce((s, a) => s + (a.calculationRecord?.finalTime ?? 0), 0),
      0
    );
  }

  setOperationNumber(operationNumber: number): void {
    this.props.operationNumber = operationNumber;
  }

  setSortKey(sortKey: SortKey): void {
    this.props.sortKey = sortKey;
  }

  /** "Hloupý" setter - shodu zdroje s typy operací existujících Activity hlídá
   *  use case v Application vrstvě přes ResourceCapabilityRepository (Operation
   *  nesmí sama volat repozitáře). */
  assignResource(resourceId: string | undefined): void {
    this.props.resourceId = resourceId;
  }

  getPosition(positionId: string): Position {
    const position = this.positions.find((p) => p.id === positionId);
    if (!position) throw new NotFoundError("Position", positionId);
    return position;
  }

  addPosition(input: NewPositionInput): Position {
    const position = Position.create({ id: input.id, operationId: this.props.id, nazev: input.nazev });
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
