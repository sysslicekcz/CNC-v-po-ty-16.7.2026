import { CalculationStrategyRegistry, InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";

/**
 * Kompoziční kořen registrace `CalculationStrategy` implementací (AP-MCE-001
 * Fáze C §13) - JEDINÉ místo v appce, které ví, jaké konkrétní strategie
 * existují. `CalculationStrategyRegistry`/`DefaultCalculationEngine` (Domain)
 * o `TurningCalculationStrategy` nic nevědí - `resolve(category)` je čisté
 * vyhledání v `Map`, ŽÁDNÉ `if (category === "turning")` větvení (architek-
 * tonický test `calculation-engine-layering.test.ts` na tohle dohlíží).
 * Přidání `MillingCalculationStrategy` (Fáze D) je jen další `.register(...)`
 * volání tady - `TurningCalculationStrategy` se přidáním nezmění.
 */
export function createCalculationStrategyRegistry(): CalculationStrategyRegistry {
  const registry = new InMemoryCalculationStrategyRegistry();
  registry.register(new TurningCalculationStrategy());
  return registry;
}
