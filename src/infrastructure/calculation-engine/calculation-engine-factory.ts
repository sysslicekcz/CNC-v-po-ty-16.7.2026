import { CalculationEngine, DefaultCalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { createCalculationStrategyRegistry } from "./calculation-strategy-registry-factory";

/**
 * Kompoziční kořen `CalculationEngine` (AP-MCE-001 Fáze H §36) - stejný
 * princip jako `calculation-strategy-registry-factory.ts` (Fáze C): jediné
 * místo, které smí `new DefaultCalculationEngine(...)` zavolat. Presentation
 * vrstva (composition root `calculation-engine-dependencies.ts`) smí
 * importovat JEN tuhle infrastructure factory, ne `domain/calculation-engine`
 * přímo (architektonický test `calculation-engine-layering.test.ts`
 * "Presentation neimportuje nic z domain/calculation-engine přímo"). Vrací
 * registr I engine (SDÍLÍ jednu instanci registru) - `Validate*UseCase`
 * potřebuje samotný registr, `Calculate*UseCase` potřebuje engine.
 */
export function createCalculationEngineWithRegistry(): { engine: CalculationEngine; registry: CalculationStrategyRegistry } {
  const registry = createCalculationStrategyRegistry();
  return { engine: new DefaultCalculationEngine(registry), registry };
}
