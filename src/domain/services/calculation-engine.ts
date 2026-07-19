import { CalcOutput } from "../aggregates/routing-sheet/types";

/** Verze aktuálně platného výpočtového algoritmu - viz Calculation.algorithmVersion.
 *  Zvýšit při jakékoli změně vzorců, aby staré uložené výsledky zůstaly dohledatelně
 *  svázané s verzí, se kterou vznikly (zadání: "Výpočtové vzorce nyní neměň, jen
 *  navrhni jejich místo v architektuře"). */
export const CURRENT_ALGORITHM_VERSION = "vba-port-1";

/** Port pro výpočtový engine - doména zná jen tohle rozhraní, konkrétní
 *  implementace (dnes adaptér nad lib/calc.ts, viz infrastructure/calculation)
 *  se do ní injektuje zvenčí (Dependency Inversion). `inputParameters` je záměrně
 *  `unknown` na úrovni portu - konkrétní tvar dat rozhoduje `calculationType`,
 *  validace/cast je na implementaci. */
export interface CalculationEngine {
  compute(calculationType: string, inputParameters: unknown, algorithmVersion: string): CalcOutput;
}
