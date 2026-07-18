import { ValidationError } from "../../errors/validation-error";
import { ConflictError } from "../../errors/conflict-error";
import { NotFoundError } from "../../errors/not-found-error";
import { InvalidStateError } from "../../errors/invalid-state-error";
import { SortKey } from "../../value-objects/sort-key";
import { OperationNumber } from "../../value-objects/operation-number";
import { DomainEvent } from "../../events/domain-event";
import { Operation, NewOperationInput } from "./operation";
import { Position, NewPositionInput } from "./position";
import { Activity, NewActivityInput, RecordCalculationInput } from "./activity";
import { Calculation } from "./calculation";

export type RoutingSheetStav = "draft" | "released" | "archived";
// Připraveno na budoucí rozšíření o "review" | "approved" | "obsolete" (viz zadání,
// bod 6) - přidání další hodnoty je aditivní změna typu, ne přestavba modelu.

export interface RoutingSheetProps {
  id: string;
  partId: string;
  nazev: string;
  verze: string;
  stav: RoutingSheetStav;
  createdAt: number;
  updatedAt?: number;
  isDefault?: boolean;
  /** Self-reference na verzi, ze které tenhle postup vznikl (revizní workflow) -
   *  vyplňuje budoucí ReviseRoutingSheetUseCase, dnes se jen rezervuje místo. */
  previousVersionId?: string;
  releasedAt?: number;
}

const OPERATION_NUMBER_STEP = 10;

/**
 * Aggregate Root nad celou technologickou strukturou dílu - Operation, Position,
 * Activity, Calculation se mění výhradně přes metody tady, nikdy přímým zápisem
 * přes jejich vlastní repozitáře (žádné takové repozitáře ani neexistují - viz
 * docs/adr/0001, docs/adr/0008). Aplikační vrstva smí volat jen metody
 * RoutingSheet - i když jsou metody addPosition()/addActivity() na Operation/
 * Position technicky veřejné (kvůli tomu, aby je tahle třída mohla volat),
 * jsou to interní implementační detaily agregátu, ne oficiální vstupní bod.
 *
 * Hlídá:
 *  - existenci rodičovské entity před vložením potomka (getOperation/getPosition
 *    vyhodí NotFoundError, pokud rodič neexistuje),
 *  - unikátnost id v rámci celého stromu (assertIdIsFree),
 *  - že vkládaný sortKey vždy vznikne přes SortKey.between/initial (veřejné API
 *    nikdy nepřijímá sortKey zvenčí, takže kolize sourozeneckého pořadí nemůže
 *    vzniknout),
 *  - neměnnost vydaného/archivovaného postupu (assertEditable).
 */
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

  // --- Getters ---

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

  // --- Operation ---

  addOperation(input: NewOperationInput): Operation {
    this.assertEditable();
    this.assertIdIsFree(input.id);
    const sorted = this.operationList;
    const lastOperation = sorted[sorted.length - 1];
    const operationNumber = lastOperation
      ? OperationNumber.next(lastOperation.operationNumber, OPERATION_NUMBER_STEP)
      : OperationNumber.create(OPERATION_NUMBER_STEP);
    const operation = Operation.create({
      id: input.id,
      operationNumber,
      sortKey: SortKey.between(lastOperation?.sortKey ?? null, null),
      nazev: input.nazev,
      stav: "aktivni",
      machineId: input.machineId,
      technologickaPoznamka: input.technologickaPoznamka,
    });
    this.operations.push(operation);
    this.raise({ type: "OperationAdded", aggregateId: this.props.id, occurredAt: new Date() });
    return operation;
  }

  /** Přesune operaci za `afterOperationId` (null = na začátek) - mění sortKey jen
   *  přesouvané položky, žádný jiný záznam se nepřepisuje. */
  reorderOperations(operationId: string, afterOperationId: string | null): void {
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
   *  pořadí - čistě zobrazovací pole, sortKey se nemění. */
  renumberOperations(): void {
    this.assertEditable();
    this.operationList.forEach((operation, index) => {
      operation.setOperationNumber(OperationNumber.create((index + 1) * OPERATION_NUMBER_STEP));
    });
  }

  removeOperation(operationId: string): void {
    this.assertEditable();
    if (!this.operations.some((o) => o.id === operationId)) {
      throw new NotFoundError("Operation", operationId);
    }
    this.operations = this.operations.filter((o) => o.id !== operationId);
  }

  assignMachineToOperation(operationId: string, machineId: string | undefined): void {
    this.assertEditable();
    this.getOperation(operationId).assignMachine(machineId);
    this.raise({ type: "MachineAssignedToOperation", aggregateId: this.props.id, occurredAt: new Date() });
  }

  // --- Position (musí patřit existující Operation) ---

  addPosition(operationId: string, input: NewPositionInput): Position {
    this.assertEditable();
    this.assertIdIsFree(input.id);
    const operation = this.getOperation(operationId); // NotFoundError => zákaz vložení Position mimo Operation
    return operation.addPosition(input);
  }

  removePosition(operationId: string, positionId: string): void {
    this.assertEditable();
    this.getOperation(operationId).removePosition(positionId);
  }

  // --- Activity (musí patřit existující Position existující Operation) ---

  addActivity(operationId: string, positionId: string, input: NewActivityInput): Activity {
    this.assertEditable();
    this.assertIdIsFree(input.id);
    const operation = this.getOperation(operationId);
    const position = operation.getPosition(positionId); // NotFoundError => zákaz vložení Activity mimo Position
    return position.addActivity(input);
  }

  moveActivity(operationId: string, positionId: string, activityId: string, afterActivityId: string | null): void {
    this.assertEditable();
    this.getOperation(operationId).getPosition(positionId).moveActivity(activityId, afterActivityId);
  }

  removeActivity(operationId: string, positionId: string, activityId: string): void {
    this.assertEditable();
    this.getOperation(operationId).getPosition(positionId).removeActivity(activityId);
  }

  assignToolToActivity(operationId: string, positionId: string, activityId: string, toolId: string | undefined): void {
    this.assertEditable();
    const activity = this.getOperation(operationId).getPosition(positionId).getActivity(activityId);
    activity.assignTool(toolId);
    this.raise({ type: "ToolAssignedToActivity", aggregateId: this.props.id, occurredAt: new Date() });
  }

  // --- Calculation (musí patřit existující Activity) ---

  recordCalculation(
    operationId: string,
    positionId: string,
    activityId: string,
    input: RecordCalculationInput
  ): Calculation {
    this.assertEditable();
    this.assertIdIsFree(input.id); // zákaz vložení Calculation mimo Activity je dán tím, že Activity musí existovat (getActivity níže)
    const activity = this.getOperation(operationId).getPosition(positionId).getActivity(activityId);
    const calculation = activity.recordCalculation(input);
    this.raise({ type: "CalculationRun", aggregateId: this.props.id, occurredAt: new Date() });
    return calculation;
  }

  applyManualCorrection(
    operationId: string,
    positionId: string,
    activityId: string,
    minutes: number | undefined
  ): Calculation {
    this.assertEditable();
    return this.getOperation(operationId).getPosition(positionId).getActivity(activityId).applyManualCorrection(minutes);
  }

  // --- Revizní workflow (minimální pravidla, viz zadání bod 16) ---

  /** draft -> released. Vydaný postup nelze běžně upravovat (assertEditable to
   *  vynucuje pro všechny mutační metody výše). Kompletní klonování revize
   *  (ReviseRoutingSheetUseCase) není v tomto kroku implementované - jen pole
   *  previousVersionId/releasedAt jsou připravená. */
  release(releasedAt: Date): void {
    if (this.props.stav !== "draft") {
      throw new InvalidStateError(`Nelze vydat postup ve stavu "${this.props.stav}" - vydat lze jen draft.`);
    }
    this.props.stav = "released";
    this.props.releasedAt = releasedAt.getTime();
    this.raise({ type: "RoutingSheetReleased", aggregateId: this.props.id, occurredAt: releasedAt });
  }

  private assertEditable(): void {
    if (this.props.stav !== "draft") {
      throw new InvalidStateError(
        `Nelze upravit postup ve stavu "${this.props.stav}" - jen draft je editovatelný. ` +
          `Pro úpravu vydaného postupu je potřeba nejdřív vytvořit novou revizi.`
      );
    }
  }

  private assertIdIsFree(id: string): void {
    if (this.collectAllIds().has(id)) {
      throw new ConflictError(`Id "${id}" už je v tomto technologickém postupu použité.`);
    }
  }

  private collectAllIds(): Set<string> {
    const ids = new Set<string>([this.props.id]);
    for (const operation of this.operations) {
      ids.add(operation.id);
      for (const position of operation.positionList) {
        ids.add(position.id);
        for (const activity of position.activityList) {
          ids.add(activity.id);
          if (activity.calculation) ids.add(activity.calculation.id);
        }
      }
    }
    return ids;
  }

  /** Vyzvedne a vyprázdní nashromážděné doménové události - Application vrstva je
   *  po úspěšném uložení agregátu rozešle dál. Dnes nemá appka žádného posluchače -
   *  jen rezervované místo v architektuře (viz zadání, bod 15, a docs/adr/0001). */
  pullEvents(): DomainEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  private raise(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }
}
