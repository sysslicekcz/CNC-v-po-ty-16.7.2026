import { ValidationError } from "../errors/validation-error";
import { ConflictError } from "../errors/conflict-error";
import { NotFoundError } from "../errors/not-found-error";
import { SortKey } from "../value-objects/sort-key";
import { DomainEvent } from "../events/domain-event";
import { Operation, NewOperationInput } from "./operation";

export type RoutingSheetStav = "draft" | "released" | "archived";

export interface RoutingSheetProps {
  id: string;
  partId: string;
  nazev: string;
  verze: string;
  stav: RoutingSheetStav;
  createdAt: number;
  poznamka?: string;
  updatedAt?: number;
  isDefault?: boolean;
  /** Self-reference na verzi, ze které tenhle postup vznikl (revizní workflow,
   *  report v3 bod 5) - vyplňuje budoucí ReviseRoutingSheetUseCase, dnes se jen
   *  rezervuje místo ve schématu. */
  previousVersionId?: string;
  releasedAt?: number;
}

const OPERATION_NUMBER_STEP = 10;

/** Aggregate Root nad celou technologickou strukturou dílu (report v3, bod 1) -
 *  Operation, Position, Activity, Calculation se mění výhradně přes metody tady,
 *  nikdy přímým zápisem přes jejich vlastní repozitáře. RoutingSheetRepository
 *  ukládá/načítá vždy celý strom atomicky. */
export class RoutingSheet {
  private operations: Operation[] = [];
  private pendingEvents: DomainEvent[] = [];

  private constructor(private props: RoutingSheetProps) {}

  static create(props: RoutingSheetProps): RoutingSheet {
    if (!props.partId.trim()) throw new ValidationError("RoutingSheet: 'partId' nesmí být prázdné.");
    if (!props.nazev.trim()) throw new ValidationError("RoutingSheet: 'nazev' nesmí být prázdný.");
    return new RoutingSheet({ ...props });
  }

  static restore(props: RoutingSheetProps, operations: Operation[]): RoutingSheet {
    const routingSheet = new RoutingSheet({ ...props });
    routingSheet.operations = [...operations];
    return routingSheet;
  }

  get id(): string {
    return this.props.id;
  }
  get partId(): string {
    return this.props.partId;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get verze(): string {
    return this.props.verze;
  }
  get stav(): RoutingSheetStav {
    return this.props.stav;
  }
  get createdAt(): number {
    return this.props.createdAt;
  }
  get poznamka(): string | undefined {
    return this.props.poznamka;
  }
  get updatedAt(): number | undefined {
    return this.props.updatedAt;
  }
  get isDefault(): boolean {
    return this.props.isDefault ?? false;
  }
  get previousVersionId(): string | undefined {
    return this.props.previousVersionId;
  }
  get releasedAt(): number | undefined {
    return this.props.releasedAt;
  }

  /** Seřazené podle sortKey. */
  get operationList(): readonly Operation[] {
    return [...this.operations].sort((a, b) => a.sortKey.compareTo(b.sortKey));
  }

  getOperation(operationId: string): Operation {
    const operation = this.operations.find((o) => o.id === operationId);
    if (!operation) throw new NotFoundError("Operation", operationId);
    return operation;
  }

  addOperation(input: NewOperationInput): Operation {
    this.assertEditable();
    const sorted = this.operationList;
    const lastKey = sorted.length ? sorted[sorted.length - 1].sortKey : null;
    const operationNumber = sorted.length
      ? sorted[sorted.length - 1].operationNumber + OPERATION_NUMBER_STEP
      : OPERATION_NUMBER_STEP;
    const operation = Operation.create({
      id: input.id,
      routingSheetId: this.props.id,
      operationNumber,
      sortKey: SortKey.between(lastKey, null),
      nazev: input.nazev,
      stav: "aktivni",
      resourceId: input.resourceId,
      technologickaPoznamka: input.technologickaPoznamka,
    });
    this.operations.push(operation);
    this.pendingEvents.push({
      type: "OperationAdded",
      aggregateId: this.props.id,
      occurredAt: Date.now(),
      operationId: operation.id,
    });
    return operation;
  }

  /** Přesune operaci za `afterOperationId` (null = na začátek) - mění sortKey jen
   *  přesouvané položky, žádný jiný záznam se nepřepisuje (viz zadání - drag&drop
   *  bez přečíslování ostatních). */
  moveOperation(operationId: string, afterOperationId: string | null): void {
    this.assertEditable();
    const sorted = this.operationList;
    const moving = sorted.find((o) => o.id === operationId);
    if (!moving) throw new NotFoundError("Operation", operationId);
    const rest = sorted.filter((o) => o.id !== operationId);
    const afterIndex = afterOperationId ? rest.findIndex((o) => o.id === afterOperationId) : -1;
    if (afterOperationId && afterIndex === -1) throw new NotFoundError("Operation", afterOperationId);
    const prev = afterIndex >= 0 ? rest[afterIndex] : null;
    const next = afterIndex >= 0 ? (rest[afterIndex + 1] ?? null) : (rest[0] ?? null);
    moving.setSortKey(SortKey.between(prev?.sortKey ?? null, next?.sortKey ?? null));
  }

  /** Přečísluje operationNumber všech operací po deseti podle aktuálního sortKey
   *  pořadí - čistě zobrazovací pole (sortKey se nemění). */
  renumberOperations(): void {
    this.operationList.forEach((operation, index) => {
      operation.setOperationNumber((index + 1) * OPERATION_NUMBER_STEP);
    });
  }

  removeOperation(operationId: string): void {
    this.assertEditable();
    if (!this.operations.some((o) => o.id === operationId)) {
      throw new NotFoundError("Operation", operationId);
    }
    this.operations = this.operations.filter((o) => o.id !== operationId);
  }

  private assertEditable(): void {
    if (this.props.stav !== "draft") {
      throw new ConflictError(
        `Nelze upravit postup ve stavu "${this.props.stav}" - jen draft je editovatelný. ` +
          `Pro úpravu vydaného postupu je potřeba nejdřív vytvořit novou revizi.`
      );
    }
  }

  /** Vyzvedne a vyprázdní nashromážděné doménové události - Application vrstva je
   *  po úspěšném uložení agregátu rozešle dál. Dnes nemá appka žádného posluchače,
   *  jen rezervované místo v architektuře (viz report v3, bod 5). */
  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}
