import { CalculationIssue } from "../entities/types";
import { grindingIssue } from "./grinding-issue-codes";

/** Vstup pro `resolveWheelDressing()` (AP-MCE-001 Fáze E §7). */
export interface WheelDressingStrategyInput {
  dressingIntervalPieces?: number;
  dressingIntervalMinutes?: number;
  dressingTimeMin?: number;
  /** Výchozí `true` - broušení dávky se typicky začíná na čerstvě
   *  orovnaném kotouči. */
  initialDressingRequired?: boolean;
  /** Explicitní PŘEPIS automaticky odvozeného `intervalDressings` - stejný
   *  princip přednosti jako `GrindingPassStrategyInput.passCount`. */
  manualPlannedDressings?: number;
}

export interface WheelDressingResolution {
  /** §7 "orovnání před první operací" - 0 nebo 1. */
  initialDressings: number;
  /** §7 "orovnání po počtu kusů"/"orovnání po minutách broušení" -
   *  deterministicky spočtené z `dressingIntervalPieces`/`dressingInterval
   *  Minutes` (přísnější/vyšší z obou, pokud jsou zadané obě). `0`, pokud je
   *  `manualPlannedDressings` zadané (§7 "Ruční orovnání" má přednost). */
  intervalDressings: number;
  /** §7 "ruční orovnání" - z `manualPlannedDressings`. */
  manualDressings: number;
  /** §7 "automatické orovnání" na základě podmínky (opotřebení zjištěné za
   *  provozu) - MVP nemá žádný senzorický/podmínkový vstup k dispozici, proto
   *  vždy `0` (zdokumentovaná mezera rozsahu, pole existuje pro budoucí
   *  rozšíření breakdownu beze změny tvaru). */
  conditionTriggeredDressings: number;
  totalDressings: number;
  totalDressingTimeMin: number;
  usedDefaultInterval: boolean;
  manuallyOverridden: boolean;
  warnings: CalculationIssue[];
}

/** §7 MVP výchozí interval orovnání, pokud volající nezadá ani kusový, ani
 *  časový interval - zdokumentovaná konzervativní konstanta (spíš častější
 *  orovnání než riskovat opotřebený kotouč). */
const FALLBACK_DRESSING_INTERVAL_PIECES = 20;
/** §7 MVP výchozí čas JEDNOHO orovnání, pokud `dressingTimeMin` chybí. */
const FALLBACK_DRESSING_TIME_MIN = 1;

/**
 * `resolveWheelDressing` (AP-MCE-001 Fáze E §7) - ČISTÁ funkce, žádné I/O.
 * Rozlišuje ČTYŘI typy orovnání (§7 "Každý typ musí mít samostatný
 * breakdown") - `intervalDressings`/`manualDressings` se NIKDY nesčítají
 * (ruční přepis nahrazuje automatický odhad, stejný princip jako Fáze C/D
 * `manualPlannedToolChanges`).
 */
export function resolveWheelDressing(input: WheelDressingStrategyInput, quantity: number, totalGrindingTimeMin: number): WheelDressingResolution {
  const warnings: CalculationIssue[] = [];
  const initialDressings = input.initialDressingRequired === false ? 0 : 1;
  const dressingTimeMin = input.dressingTimeMin ?? FALLBACK_DRESSING_TIME_MIN;

  if (input.manualPlannedDressings !== undefined) {
    const totalDressings = initialDressings + input.manualPlannedDressings;
    return {
      initialDressings,
      intervalDressings: 0,
      manualDressings: input.manualPlannedDressings,
      conditionTriggeredDressings: 0,
      totalDressings,
      totalDressingTimeMin: totalDressings * dressingTimeMin,
      usedDefaultInterval: false,
      manuallyOverridden: true,
      warnings,
    };
  }

  const usedDefaultInterval = input.dressingIntervalPieces === undefined && input.dressingIntervalMinutes === undefined;
  if (usedDefaultInterval) {
    warnings.push(grindingIssue("DRESSING_INTERVAL_DEFAULTED", "Interval orovnání kotouče nebyl zadán - použit systémový výchozí interval."));
  }

  const byPieces =
    input.dressingIntervalPieces !== undefined && input.dressingIntervalPieces > 0
      ? Math.floor(quantity / input.dressingIntervalPieces)
      : usedDefaultInterval
        ? Math.floor(quantity / FALLBACK_DRESSING_INTERVAL_PIECES)
        : 0;
  const byMinutes =
    input.dressingIntervalMinutes !== undefined && input.dressingIntervalMinutes > 0 ? Math.floor(totalGrindingTimeMin / input.dressingIntervalMinutes) : 0;
  const intervalDressings = Math.max(byPieces, byMinutes);

  const totalDressings = initialDressings + intervalDressings;
  return {
    initialDressings,
    intervalDressings,
    manualDressings: 0,
    conditionTriggeredDressings: 0,
    totalDressings,
    totalDressingTimeMin: totalDressings * dressingTimeMin,
    usedDefaultInterval,
    manuallyOverridden: false,
    warnings,
  };
}
