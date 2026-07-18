import { HourlyRate } from "../value-objects/hourly-rate";
import { CuttingParameters } from "../value-objects/cutting-parameters";

export type CalculationInputRow = Record<string, string | number | null>;

export interface OpResult {
  label: string;
  kontura: string;
  cas: number | null; // null = chyba/varování, viz `note`
  note?: string;
}

/** Tvarem odpovídá dnešnímu CalcOutput z lib/calc.ts - domain má vlastní typ, aby
 *  nezávisel na umístění staré implementace; CalculationEngine adapter mezi nimi
 *  převádí (viz services/calculation-engine). */
export interface CalcOutput {
  rows: OpResult[];
  total: number;
}

/** Zamrzlá kopie popisných/cenových údajů zdroje a nástroje z okamžiku výpočtu -
 *  pozdější přejmenování/přecenění Resource/Tool nezmění historicky uložený výsledek
 *  (report v3, bod 2). */
export interface CalculationSnapshot {
  resourceId: string;
  resourceNazev: string;
  resourceSazba: HourlyRate;
  toolId?: string;
  toolNazev?: string;
  toolTypeId?: string;
  cuttingParameters?: CuttingParameters;
  operationTypeId: string;
  operationTypeKod: string;
}

export interface CalculationProps {
  id: string;
  activityId: string;
  inputParameters: CalculationInputRow[];
  result: CalcOutput;
  algorithmVersion: string;
  snapshot: CalculationSnapshot;
  manualCorrection?: number;
  calculatedAt: number;
}

/** Výsledek výpočtu jedné Activity. Vzniká/mění se jen přes Activity.recordCalculation() -
 *  obojí je uvnitř agregátu RoutingSheet. */
export class Calculation {
  private constructor(private props: CalculationProps) {}

  static create(props: CalculationProps): Calculation {
    return new Calculation({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get activityId(): string {
    return this.props.activityId;
  }
  get inputParameters(): readonly CalculationInputRow[] {
    return this.props.inputParameters;
  }
  get result(): CalcOutput {
    return this.props.result;
  }
  get algorithmVersion(): string {
    return this.props.algorithmVersion;
  }
  get snapshot(): CalculationSnapshot {
    return this.props.snapshot;
  }
  get manualCorrection(): number | undefined {
    return this.props.manualCorrection;
  }
  get calculatedAt(): number {
    return this.props.calculatedAt;
  }

  get computedTime(): number {
    return this.props.result.total;
  }

  /** Ruční korekce má přednost před vypočteným časem - viz report. */
  get finalTime(): number {
    return this.props.manualCorrection ?? this.computedTime;
  }

  setManualCorrection(minutes: number | undefined): void {
    this.props.manualCorrection = minutes;
  }
}
