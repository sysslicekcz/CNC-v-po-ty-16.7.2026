import { CalculationStrategyRegistry, InMemoryCalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { TurningCalculationStrategy } from "@/domain/calculation-engine/turning/turning-calculation-strategy";
import { MillingCalculationStrategy } from "@/domain/calculation-engine/milling/milling-calculation-strategy";
import { GrindingCalculationStrategy } from "@/domain/calculation-engine/grinding/grinding-calculation-strategy";
import { ManualOperationCalculationStrategy } from "@/domain/calculation-engine/manual/manual-operation-calculation-strategy";
import { InspectionCalculationStrategy } from "@/domain/calculation-engine/inspection/inspection-calculation-strategy";

/**
 * Kompoziční kořen registrace `CalculationStrategy` implementací (AP-MCE-001
 * Fáze C §13) - JEDINÉ místo v appce, které ví, jaké konkrétní strategie
 * existují. `CalculationStrategyRegistry`/`DefaultCalculationEngine` (Domain)
 * o `TurningCalculationStrategy`/`MillingCalculationStrategy` nic nevědí -
 * `resolve(category)` je čisté vyhledání v `Map`, ŽÁDNÉ `if (category ===
 * "turning")` větvení (architektonický test na tohle dohlíží). Přidání Fáze D
 * `MillingCalculationStrategy` byl jen další `.register(...)` volání tady -
 * `TurningCalculationStrategy` se přidáním nezměnila.
 */
export function createCalculationStrategyRegistry(): CalculationStrategyRegistry {
  const registry = new InMemoryCalculationStrategyRegistry();
  registry.register(new TurningCalculationStrategy());
  registry.register(new MillingCalculationStrategy());
  registry.register(new GrindingCalculationStrategy());
  registry.register(new ManualOperationCalculationStrategy());
  registry.register(new InspectionCalculationStrategy());
  return registry;
}
