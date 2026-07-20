import type { OperationCategory } from "../enums/operation-category";
import { CalculationStrategy } from "./calculation-strategy";
import { UnknownOperationCategoryError } from "../errors/calculation-error";

/**
 * Registr `CalculationStrategy` podle kategorie operace (AP-MCE-001 §11).
 * Rozhraní žije v Domain (je to čistá, bezstavová logika bez I/O - stejné
 * zdůvodnění jako `resolveCuttingConditions()` v existujícím modulu), ne v
 * Application.
 */
export interface CalculationStrategyRegistry {
  /** Zaregistruje strategii pod jejím vlastním `operationCategory`. Druhé
   *  volání se STEJNOU kategorií přepíše dřívější registraci (užitečné pro
   *  testy/DI kontejner, který sestavuje registr znovu) - v produkčním
   *  zapojení (Fáze C+) se každá kategorie registruje jen jednou. */
  register(strategy: CalculationStrategy): void;
  /** Vyhodí `UnknownOperationCategoryError`, pokud pro danou kategorii není
   *  nic zaregistrované - NIKDY nevrací `null`/`undefined` (volající by na to
   *  musel zapomenout ošetřit, přesně to `AP-MCE-001 §18` chce zabránit). */
  resolve(category: OperationCategory): CalculationStrategy;
  /** `true`, pokud pro kategorii existuje registrovaná strategie - použití:
   *  UI "Operation type selection" (AP-MCE-001 §20) může nabídnout jen
   *  kategorie, které appka aktuálně umí spočítat. */
  has(category: OperationCategory): boolean;
  list(): readonly CalculationStrategy[];
}

/**
 * Výchozí implementace nad `Map` - žádná perzistence, žádné I/O (registrace
 * strategií je věc dependency-injection sestavení appky, ne uložených dat).
 * Fáze A ji sestaví PRÁZDNOU (žádná konkrétní strategie ještě neexistuje) -
 * `resolve(...)` proto v tuhle chvíli vždy vyhodí `UnknownOperationCategory
 * Error`, dokud Fáze C-F nezaregistrují první skutečné strategie. To je
 * očekávané chování "Foundation" fáze, ne chyba.
 */
export class InMemoryCalculationStrategyRegistry implements CalculationStrategyRegistry {
  private readonly strategies = new Map<OperationCategory, CalculationStrategy>();

  register(strategy: CalculationStrategy): void {
    this.strategies.set(strategy.operationCategory, strategy);
  }

  resolve(category: OperationCategory): CalculationStrategy {
    const strategy = this.strategies.get(category);
    if (!strategy) throw new UnknownOperationCategoryError(category);
    return strategy;
  }

  has(category: OperationCategory): boolean {
    return this.strategies.has(category);
  }

  list(): readonly CalculationStrategy[] {
    return Array.from(this.strategies.values());
  }
}
