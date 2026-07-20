import { CalculationEngineEvent } from "@/domain/calculation-engine/events/calculation-engine-event";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";

/**
 * Výchozí implementace `DomainEventPublisher` (AP-MCE-001 Fáze B §13) - appka
 * dnes nemá žádnou event sběrnici/perzistenci (viz komentář u
 * `CalculationEngineEvent`), tenhle publisher eventy jen sbírá do paměti.
 * Použití: testy (ověření, že use case danou událost skutečně vyvolal) a
 * dočasné wiring, dokud nevznikne skutečná sběrnice/perzistence eventů.
 */
export class InMemoryDomainEventPublisher implements DomainEventPublisher {
  private readonly events: CalculationEngineEvent[] = [];

  async publish(event: CalculationEngineEvent): Promise<void> {
    this.events.push(event);
  }

  publishedEvents(): readonly CalculationEngineEvent[] {
    return this.events;
  }

  clear(): void {
    this.events.length = 0;
  }
}
