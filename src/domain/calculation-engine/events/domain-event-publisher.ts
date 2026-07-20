import { CalculationEngineEvent } from "./calculation-engine-event";

/**
 * Port pro publikaci `CalculationEngineEvent` (AP-MCE-001 Fáze B §13). Use
 * casy volají `publish` PO úspěšném uložení entity - stejné pořadí jako
 * zbytek appky (uložit -> pak reagovat), nikdy naopak.
 */
export interface DomainEventPublisher {
  publish(event: CalculationEngineEvent): Promise<void>;
}
