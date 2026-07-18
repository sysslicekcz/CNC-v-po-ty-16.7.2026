import { computeOperation } from "@/lib/results";
import { CalcOutput, CalculationInputRow } from "../../entities/calculation";

/** Aktuální verze výpočtového algoritmu - viz Calculation.algorithmVersion. Zvýšit
 *  při jakékoli změně vzorců v lib/calc.ts, aby staré uložené výsledky zůstaly
 *  dohledatelně svázané s verzí, se kterou vznikly (viz report - "Výpočtové vzorce
 *  nyní neměň, jen navrhni jejich místo v architektuře"). */
export const CURRENT_ALGORITHM_VERSION = "vba-port-1";

/** Tenký adapter nad existujícím src/lib/calc.ts + src/lib/results.ts
 *  (computeOperation) - vzorce se v tomhle kroku neupravují, jen dostávají vlastní
 *  vstupní bod v doménové vrstvě. Existující UI (ResultsPanel apod.) dál volá
 *  lib/results.ts přímo beze změny; tenhle adapter je pro novou aplikační vrstvu.
 *  Až se lib/calc.ts fyzicky přesune sem (plánovaný pozdější krok), adapter zmizí
 *  a CalculationEngine bude jediným zdrojem pravdy. */
export const CalculationEngine = {
  compute(calculationType: string, inputParameters: CalculationInputRow[]): CalcOutput {
    return computeOperation(calculationType, inputParameters);
  },
};
