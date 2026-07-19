import { ValidationError } from "../../errors/validation-error";
import { SortKey } from "../../value-objects/sort-key";
import { EntityStav } from "../../entities/common";
import { Calculation, CalculationProps } from "./calculation";
import { ActivityKind } from "./types";

export interface ActivityProps {
  id: string;
  operationTypeId: string;
  calculationType: string;
  sortKey: SortKey;
  kind: ActivityKind;
  toolId?: string;
  technologickaPoznamka?: string;
  stav?: EntityStav;
}

export interface NewActivityInput {
  id: string;
  operationTypeId: string;
  calculationType: string;
  kind?: ActivityKind; // výchozí "calculation" - v první verzi převažující hodnota
  toolId?: string;
  technologickaPoznamka?: string;
}

export type RecordCalculationInput = Omit<CalculationProps, "manualCorrection">;

/** Jedna technologická činnost / kalkulační blok v rámci upnutí. Musí umět
 *  existovat i bez Calculation (kind "manual"/"inspection"/"ndt"/"external") -
 *  kontrola, NDT, odjehlení, čištění, balení, kooperace a ruční operace zatím
 *  žádný číselný výpočet nemají. Nenese odkaz na Position - je to vnořená entita
 *  (viz aggregates/routing-sheet/position.ts). */
export class Activity {
  private calculation_?: Calculation;

  private constructor(private props: ActivityProps) {}

  static create(props: ActivityProps): Activity {
    if (!props.operationTypeId.trim()) throw new ValidationError("Activity: 'operationTypeId' nesmí být prázdné.");
    if (!props.calculationType.trim()) throw new ValidationError("Activity: 'calculationType' nesmí být prázdný.");
    return new Activity({ ...props });
  }

  static restore(props: ActivityProps, calculation?: Calculation): Activity {
    const activity = new Activity({ ...props });
    activity.calculation_ = calculation;
    return activity;
  }

  get id(): string {
    return this.props.id;
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
  get kind(): ActivityKind {
    return this.props.kind;
  }
  get toolId(): string | undefined {
    return this.props.toolId;
  }
  get technologickaPoznamka(): string | undefined {
    return this.props.technologickaPoznamka;
  }
  get stav(): EntityStav | undefined {
    return this.props.stav;
  }
  /** V první verzi drží Activity jen poslední Calculation. recordCalculation() vždy
   *  vytváří novou instanci (nikdy nemutuje starou), takže přidání historie více
   *  výpočtů později je aditivní změna (např. calculationHistory: Calculation[]
   *  vedle tohoto getteru), ne přepis existujícího chování. */
  get calculation(): Calculation | undefined {
    return this.calculation_;
  }

  setSortKey(sortKey: SortKey): void {
    this.props.sortKey = sortKey;
  }

  /** "Hloupý" setter - shodu nástroje s operací/strojem hlídá use case v Application
   *  vrstvě (Activity nesmí sama volat repozitáře Tool/Machine). */
  assignTool(toolId: string | undefined): void {
    this.props.toolId = toolId;
  }

  changeOperationType(operationTypeId: string): void {
    if (!operationTypeId.trim()) throw new ValidationError("Activity: 'operationTypeId' nesmí být prázdné.");
    this.props.operationTypeId = operationTypeId;
  }

  /** Zapíše výsledek výpočtu vč. zamrzlého kontextu (snapshot). Nikdy neupravuje
   *  předchozí Calculation instanci - jen nahrazuje referenci touto novou. Předchozí
   *  ruční korekce se nepřenáší (nový výpočet je nový stav). */
  recordCalculation(input: RecordCalculationInput): Calculation {
    this.calculation_ = Calculation.create({ ...input, manualCorrection: undefined });
    return this.calculation_;
  }

  /** Nahradí aktuální Calculation kopií se změněnou ruční korekcí - vyžaduje, aby
   *  už nějaký výpočet proběhl. */
  applyManualCorrection(minutes: number | undefined): Calculation {
    if (!this.calculation_) {
      throw new ValidationError("Activity: nelze nastavit ruční korekci bez existujícího výpočtu.");
    }
    this.calculation_ = this.calculation_.withManualCorrection(minutes);
    return this.calculation_;
  }
}
