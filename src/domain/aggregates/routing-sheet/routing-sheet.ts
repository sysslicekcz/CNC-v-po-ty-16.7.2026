import { ValidationError } from "../../errors/validation-error";
import { ConflictError } from "../../errors/conflict-error";
import { NotFoundError } from "../../errors/not-found-error";
import { InvalidStateError } from "../../errors/invalid-state-error";
import { SortKey } from "../../value-objects/sort-key";
import { OperationNumber } from "../../value-objects/operation-number";
import { DomainEvent } from "../../events/domain-event";
import { Operation, NewOperationInput, OperationResourceAssignment } from "./operation";
import { Position, NewPositionInput } from "./position";
import { Activity, NewActivityInput, RecordCalculationInput } from "./activity";
import { Calculation } from "./calculation";

export type RoutingSheetStav = "draft" | "released" | "archived";
// "archived" odpovídá pojmu "obsolete" ze zadání Kroku 4 - stejný význam
// (historická revize, která už není aktuální), zachován existující český název
// místo zavádění paralelní hodnoty (zadání Krok 4, bod 3: "pokud doména používá
// jiné názvy, zachovej její konzistenci").

export interface RoutingSheetProps {
  id: string;
  tenantId: string;
  partId: string;
  nazev: string;
  popis?: string;
  verze: string;
  stav: RoutingSheetStav;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  isDefault?: boolean;
  /** Self-reference na verzi, ze které tenhle postup vznikl (revizní workflow,
   *  odpovídá `sourceRoutingSheetId` ze zadání Kroku 4 - jméno zachováno z
   *  Kroku 2). Vyplňuje CreateRoutingSheetRevisionUseCase/DuplicateRoutingSheetUseCase. */
  previousVersionId?: string;
  releasedAt?: number;
  releasedBy?: string;
}

export interface UpdateRoutingSheetHeaderInput {
  nazev?: string;
  popis?: string;
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
    if (!props.tenantId.trim()) throw new ValidationError("RoutingSheet: 'tenantId' nesmí být prázdné.");
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
  get tenantId(): string {
    return this.props.tenantId;
  }
  get partId(): string {
    return this.props.partId;
  }
  get nazev(): string {
    return this.props.nazev;
  }
  get popis(): string | undefined {
    return this.props.popis;
  }
  get verze(): string {
    return this.props.verze;
  }
  /** Číselná podoba `verze` pro editor DTO (`revision` v zadání Kroku 4) -
   *  `verze` v doméně zůstává string (viz docs/audits/step-4-audit.md). */
  get revisionNumber(): number {
    const parsed = Number.parseInt(this.props.verze, 10);
    return Number.isFinite(parsed) ? parsed : 1;
  }
  get stav(): RoutingSheetStav {
    return this.props.stav;
  }
  get createdAt(): number {
    return this.props.createdAt;
  }
  get createdBy(): string | undefined {
    return this.props.createdBy;
  }
  get updatedAt(): number | undefined {
    return this.props.updatedAt;
  }
  get updatedBy(): string | undefined {
    return this.props.updatedBy;
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
  get releasedBy(): string | undefined {
    return this.props.releasedBy;
  }

  get isEditable(): boolean {
    return this.props.stav === "draft";
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

  // --- Hlavička ---

  updateHeader(input: UpdateRoutingSheetHeaderInput): void {
    this.assertEditable();
    if (input.nazev !== undefined) {
      if (!input.nazev.trim()) throw new ValidationError("RoutingSheet: 'nazev' nesmí být prázdný.");
      this.props.nazev = input.nazev;
    }
    if (input.popis !== undefined) {
      this.props.popis = input.popis;
    }
  }

  /** Aktualizuje `updatedAt`/`updatedBy` - volá ho SaveRoutingSheetDraftUseCase
   *  před zápisem, ne repository (bookkeeping je součástí explicitní aplikační
   *  operace "uložit", ne skrytý vedlejší efekt persistence). */
  touch(updatedAt: Date, updatedBy?: string): void {
    this.assertEditable();
    this.props.updatedAt = updatedAt.getTime();
    this.props.updatedBy = updatedBy;
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
      externalResourceId: input.externalResourceId,
      technologickaPoznamka: input.technologickaPoznamka,
    });
    this.operations.push(operation);
    this.raise({ type: "OperationAdded", aggregateId: this.props.id, occurredAt: new Date() });
    return operation;
  }

  /** Vloží kopii existující operace (nové id, bez upnutí/činností/kalkulací dokud
   *  je nepřidá `duplicatePosition`/vlastní kopírovací use case) - viz
   *  DuplicateRoutingOperationUseCase, který nad touhle metodou postaví plnou
   *  kopii včetně podstromu. */
  addOperationAfter(input: NewOperationInput, afterOperationId: string | null): Operation {
    const operation = this.addOperation(input);
    this.reorderOperations(operation.id, afterOperationId);
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

  updateOperation(
    operationId: string,
    input: {
      nazev?: string;
      technologickaPoznamka?: string;
      setupTimeMinutes?: number;
      unitTimeMinutes?: number;
      transferBatchSize?: number;
    }
  ): void {
    this.assertEditable();
    const operation = this.getOperation(operationId);
    if (input.nazev !== undefined) operation.rename(input.nazev);
    if (input.technologickaPoznamka !== undefined) operation.setNote(input.technologickaPoznamka);
    if (input.setupTimeMinutes !== undefined || input.unitTimeMinutes !== undefined) {
      operation.setTimes({ setupTimeMinutes: input.setupTimeMinutes, unitTimeMinutes: input.unitTimeMinutes });
    }
    if (input.transferBatchSize !== undefined) operation.setTransferBatchSize(input.transferBatchSize);
  }

  assignMachineToOperation(operationId: string, machineId: string | undefined): void {
    this.assertEditable();
    this.getOperation(operationId).assignMachine(machineId);
    this.raise({ type: "MachineAssignedToOperation", aggregateId: this.props.id, occurredAt: new Date() });
  }

  assignExternalResourceToOperation(operationId: string, externalResourceId: string | undefined): void {
    this.assertEditable();
    this.getOperation(operationId).assignExternalResource(externalResourceId);
    this.raise({ type: "ExternalResourceAssignedToOperation", aggregateId: this.props.id, occurredAt: new Date() });
  }

  /** Nastaví zdroj operace atomicky (viz OperationResourceAssignment) - jediný
   *  vstupní bod, kterým UI nikdy nemůže vytvořit neplatný mezistav "stroj i
   *  kooperace zapsané současně". */
  assignResourceToOperation(operationId: string, assignment: OperationResourceAssignment): void {
    this.assertEditable();
    const operation = this.getOperation(operationId);
    switch (assignment.type) {
      case "machine":
        operation.assignMachine(assignment.machineId);
        break;
      case "external":
        operation.assignExternalResource(assignment.externalResourceId);
        break;
      case "unassigned":
        operation.assignMachine(undefined);
        operation.assignExternalResource(undefined);
        break;
    }
  }

  // --- Position (musí patřit existující Operation) ---

  addPosition(operationId: string, input: NewPositionInput): Position {
    this.assertEditable();
    this.assertIdIsFree(input.id);
    const operation = this.getOperation(operationId); // NotFoundError => zákaz vložení Position mimo Operation
    return operation.addPosition(input);
  }

  movePosition(operationId: string, positionId: string, afterPositionId: string | null): void {
    this.assertEditable();
    this.getOperation(operationId).movePosition(positionId, afterPositionId);
  }

  renamePosition(operationId: string, positionId: string, nazev: string): void {
    this.assertEditable();
    this.getOperation(operationId).getPosition(positionId).rename(nazev);
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

  // --- Revizní workflow (zadání Krok 4, bod 4) ---

  /** draft -> released. Vydaný postup nelze běžně upravovat (assertEditable to
   *  vynucuje pro všechny mutační metody výše). Skutečná release VALIDACE
   *  (musí mít aspoň jednu operaci, každá operace má zdroj atd.) je odpovědnost
   *  Application vrstvy (ReleaseRoutingSheetUseCase/ValidateRoutingSheetUseCase),
   *  ne téhle metody - agregát sám jen vynucuje stavový přechod. */
  release(releasedAt: Date, releasedBy?: string): void {
    if (this.props.stav !== "draft") {
      throw new InvalidStateError(`Nelze vydat postup ve stavu "${this.props.stav}" - vydat lze jen draft.`);
    }
    this.props.stav = "released";
    this.props.releasedAt = releasedAt.getTime();
    this.props.releasedBy = releasedBy;
    this.raise({ type: "RoutingSheetReleased", aggregateId: this.props.id, occurredAt: releasedAt });
  }

  /** released/draft -> archived - historická revize, která už není aktuální
   *  (nahrazena novou revizí). Archivace nikdy nemaže data, jen mění `stav` -
   *  viz docs/adr/released-routing-sheet-is-immutable.md. */
  archive(): void {
    if (this.props.stav === "archived") {
      throw new InvalidStateError("Postup je už archivovaný.");
    }
    this.props.stav = "archived";
    this.raise({ type: "RoutingSheetArchived", aggregateId: this.props.id, occurredAt: new Date() });
  }

  /** Zruší příznak "výchozí" (Krok 4) - volá se na STARÉ revizi při vzniku
   *  nové (`CreateRoutingSheetRevisionUseCase`), aby měl díl vždy nejvýš
   *  jednu výchozí RoutingSheet (invariant hlídaný i migrací, viz
   *  post-validation.ts "exactly-one-default-routing-sheet-per-part").
   *  Bez guardu na `stav` - jde o bookkeeping, ne o obsahovou úpravu. */
  clearDefault(): void {
    this.props.isDefault = false;
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
