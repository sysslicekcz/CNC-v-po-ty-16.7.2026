import type { OperationCategory } from "../enums/operation-category";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";

/**
 * Strategy pattern pro typ operace (AP-MCE-001 §11) - JEDNO rozhraní, mnoho
 * implementací (`TurningCalculationStrategy`, `MillingCalculationStrategy`, ...
 * - žádná z nich není součástí Fáze A, viz implementační plán AP-MCE-001 §21
 * Fáze C-F). Přidání nové kategorie operace (i budoucí "heat_treatment" atd.)
 * je vždy JEN nová třída implementující tohle rozhraní plus jedno volání
 * `CalculationStrategyRegistry.register(...)` - existující strategie se nikdy
 * nemění (open/closed princip, explicitní požadavek zadání).
 *
 * Implementace MUSÍ být čistá - žádný přístup k repozitářům/síti/hodinám.
 * Všechno, co potřebuje zvenčí, dostane přes `input`/`context`.
 */
export interface CalculationStrategy {
  /** Klíč, pod kterým je strategie zaregistrovaná v registru - musí
   *  odpovídat `input.operationCategory` u vstupu, který umí spočítat. */
  readonly operationCategory: OperationCategory;
  /** Verze VÝPOČETNÍ LOGIKY strategie (ne verze pravidel/`RuleVersion`) -
   *  zapisuje se do `CalculationResult.strategyVersion` (AP-MCE-001 §15). */
  readonly strategyVersion: string;

  /** Vrátí seznam problémů (prázdné pole = žádný). Přítomnost položky se
   *  `severity: "error"` musí orchestrátoru zabránit zavolat `calculate(...)`
   *  (AP-MCE-001 §18). */
  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[];

  /** Vyžaduje, aby `validate(...)` na stejném vstupu nevrátila žádnou
   *  položku se `severity: "error"` - jinak je chování nedefinované
   *  (orchestrátor tohle pořadí garantuje, viz `DefaultCalculationEngine`). */
  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown;
}
