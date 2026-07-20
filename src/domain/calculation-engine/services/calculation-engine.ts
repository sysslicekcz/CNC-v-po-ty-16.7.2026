import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";
import { CalculationStrategyRegistry } from "./calculation-strategy-registry";

/**
 * Doménová služba "Domain Services: CalculationEngine" z AP-MCE-001 §10/§11 -
 * ZÁMĚRNĚ jiné jméno prostoru (`domain/calculation-engine/services/
 * calculation-engine.ts`), ne přepis existujícího `domain/services/
 * calculation-engine.ts` (legacy port nad `LegacyCalculationEngine`/
 * `lib/calc.ts`, AP-MCE-001 §00/§10 "Executive summary"). Obě rozhraní budou
 * žít vedle sebe, dokud Fáze H nepostaví `ManufacturingCalculationEngine
 * Adapter implements CalculationEngine` (ten legacy port) jako most mezi nimi
 * - Fáze A na legacy port vůbec nesahá.
 *
 * Čistá orchestrace bez I/O: vybere strategii z registru, zvaliduje vstup a
 * buď spočítá rozpad, nebo vrátí zablokovaný výsledek s důvodem - repozitáře,
 * čas (`Date.now()`), generování id atd. zůstávají v Application vrstvě
 * (`CalculateOperationUseCase`), která tuhle službu volá.
 */
export interface CalculationEngineOutcome {
  strategyVersion: string;
  /** `undefined`, pokud `blocked === true` (validace vrátila aspoň jednu
   *  položku se `severity: "error"`, `calculate()` na strategii se nevolalo). */
  breakdown?: CalculationBreakdown;
  issues: CalculationIssue[];
  blocked: boolean;
}

export interface CalculationEngine {
  readonly engineVersion: string;
  /** Může vyhodit `UnknownOperationCategoryError` (výjimečný, konfigurační
   *  stav - chybějící strategie), NIKDY ne pro běžně špatná vstupní data -
   *  ta se projeví jako `outcome.issues`/`outcome.blocked`. */
  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationEngineOutcome;
}

/**
 * Výchozí, jediná potřebná implementace `CalculationEngine` v tomhle modulu -
 * na rozdíl od `CalculationStrategy` tady nedává smysl mít víc konkurenčních
 * implementací, jen víc registrovaných strategií uvnitř JEDNOHO enginu.
 */
export class DefaultCalculationEngine implements CalculationEngine {
  constructor(
    private readonly strategyRegistry: CalculationStrategyRegistry,
    readonly engineVersion: string = "mce-v1"
  ) {}

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationEngineOutcome {
    const strategy = this.strategyRegistry.resolve(input.operationCategory);
    const issues = strategy.validate(input, context);
    const blocked = issues.some((issue) => issue.severity === "error");

    if (blocked) {
      return { strategyVersion: strategy.strategyVersion, issues, blocked: true };
    }

    const breakdown = strategy.calculate(input, context);
    return { strategyVersion: strategy.strategyVersion, breakdown, issues, blocked: false };
  }
}
