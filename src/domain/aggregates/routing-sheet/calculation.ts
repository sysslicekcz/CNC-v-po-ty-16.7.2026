import { CalcOutput, CalculationInputRow, CalculationSnapshot } from "./types";

export interface CalculationProps {
  id: string;
  inputParameters: CalculationInputRow[];
  result: CalcOutput;
  algorithmVersion: string;
  snapshot: CalculationSnapshot;
  manualCorrection?: number;
  calculatedAt?: number;
}

/** Výsledek výpočtu jedné Activity - po vytvoření immutable (žádné settery).
 *  Přepočet nebo ruční korekce nikdy nemodifikuje existující instanci, jen ji
 *  Activity.recordCalculation()/applyManualCorrection() nahradí novou - viz
 *  docs/adr/0006. Vstupní parametry i snapshot jsou zmrazené (Object.freeze),
 *  aby je nešlo omylem změnit skrz vrácenou referenci. */
export class Calculation {
  private readonly props: Readonly<CalculationProps>;

  private constructor(props: CalculationProps) {
    const frozenResult: CalcOutput = {
      total: props.result.total,
      rows: props.result.rows.map((r) => Object.freeze({ ...r })),
    };
    this.props = Object.freeze({
      ...props,
      inputParameters: props.inputParameters.map((row) => Object.freeze({ ...row })),
      result: Object.freeze(frozenResult),
      snapshot: Object.freeze({ ...props.snapshot }),
    });
  }

  static create(props: CalculationProps): Calculation {
    return new Calculation(props);
  }

  /** Vrátí novou Calculation se stejnými daty výpočtu, jen s jinou ruční korekcí -
   *  nikdy nemutuje `this`. */
  withManualCorrection(minutes: number | undefined): Calculation {
    return new Calculation({ ...this.props, manualCorrection: minutes });
  }

  get id(): string {
    return this.props.id;
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
  get calculatedAt(): number | undefined {
    return this.props.calculatedAt;
  }

  get computedTime(): number {
    return this.props.result.total;
  }

  /** Ruční korekce má přednost před vypočteným časem. */
  get finalTime(): number {
    return this.props.manualCorrection ?? this.computedTime;
  }
}
