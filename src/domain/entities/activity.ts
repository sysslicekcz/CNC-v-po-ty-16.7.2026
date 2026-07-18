import { ValidationError } from "../errors/validation-error";
import { SortKey } from "../value-objects/sort-key";
import { EntityStav } from "./operation-type";
import { Calculation, CalcOutput, CalculationInputRow, CalculationSnapshot } from "./calculation";

export interface ActivityProps {
  id: string;
  positionId: string;
  operationTypeId: string;
  calculationType: string;
  sortKey: SortKey;
  toolId?: string;
  technologickaPoznamka?: string;
  stav: EntityStav;
}

export interface NewActivityInput {
  id: string;
  operationTypeId: string;
  calculationType: string;
  toolId?: string;
  technologickaPoznamka?: string;
}

export interface RecordCalculationInput {
  id: string;
  inputParameters: CalculationInputRow[];
  result: CalcOutput;
  algorithmVersion: string;
  snapshot: CalculationSnapshot;
  calculatedAt: number;
}

/** Jedna technologická činnost / kalkulační blok v rámci upnutí - nese klasifikaci
 *  pro shodu se zdrojem (operationTypeId), konkrétní nástroj a vlastní výpočet.
 *  Odpovídá dnešnímu partOperationRows (opId + rows) na úrovni jednoho upnutí.
 *  Vnitřní entita agregátu RoutingSheet (přes Position -> Operation). */
export class Activity {
  private calculation?: Calculation;

  private constructor(private props: ActivityProps) {}

  static create(props: ActivityProps): Activity {
    if (!props.operationTypeId.trim()) throw new ValidationError("Activity: 'operationTypeId' nesmí být prázdné.");
    if (!props.calculationType.trim()) throw new ValidationError("Activity: 'calculationType' nesmí být prázdný.");
    return new Activity({ ...props });
  }

  static restore(props: ActivityProps, calculation?: Calculation): Activity {
    const activity = new Activity({ ...props });
    activity.calculation = calculation;
    return activity;
  }

  get id(): string {
    return this.props.id;
  }
  get positionId(): string {
    return this.props.positionId;
  }
  get operationTypeId(): string {
    return this.props.operationTypeId;
  }
  get calculationType(): string {
    return this.props.calculationType;
  }
  get sortKey(): SortKey {
    return this.props.sortKey;
  }
  get toolId(): string | undefined {
    return this.props.toolId;
  }
  get technologickaPoznamka(): string | undefined {
    return this.props.technologickaPoznamka;
  }
  get stav(): EntityStav {
    return this.props.stav;
  }
  get calculationRecord(): Calculation | undefined {
    return this.calculation;
  }

  setSortKey(sortKey: SortKey): void {
    this.props.sortKey = sortKey;
  }

  /** "Hloupý" setter - shodu nástroje se zdrojem/operací hlídá use case v Application
   *  vrstvě (Activity nesmí sama volat repozitáře). */
  assignTool(toolId: string | undefined): void {
    this.props.toolId = toolId;
  }

  /** "Hloupý" setter - shodu s ResourceCapability hlídá use case, ne tahle metoda
   *  (viz Operation.assignResource). */
  changeOperationType(operationTypeId: string): void {
    if (!operationTypeId.trim()) throw new ValidationError("Activity: 'operationTypeId' nesmí být prázdné.");
    this.props.operationTypeId = operationTypeId;
  }

  /** Zapíše výsledek výpočtu vč. zamrzlého kontextu (snapshot). Předchozí ruční
   *  korekce se záměrně nepřenáší - nový výpočet je nový stav, korekci musí uživatel
   *  zadat znovu, pokud je pořád potřeba. */
  recordCalculation(input: RecordCalculationInput): Calculation {
    this.calculation = Calculation.create({
      id: input.id,
      activityId: this.props.id,
      inputParameters: input.inputParameters,
      result: input.result,
      algorithmVersion: input.algorithmVersion,
      snapshot: input.snapshot,
      calculatedAt: input.calculatedAt,
    });
    return this.calculation;
  }
}
