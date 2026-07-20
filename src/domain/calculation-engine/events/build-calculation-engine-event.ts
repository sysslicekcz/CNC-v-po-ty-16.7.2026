import { CalculationEngineEvent, CalculationEngineEventType } from "./calculation-engine-event";

export interface BuildCalculationEngineEventInput {
  type: CalculationEngineEventType;
  tenantId: string;
  siteId?: string;
  entityId: string;
  entityVersion?: number;
  actorId?: string;
  correlationId?: string;
  occurredAt?: string;
}

/** Sestaví `CalculationEngineEvent` s doplněnými výchozími hodnotami
 *  (`eventId`, `correlationId`, `occurredAt`) - jediné místo, které tenhle
 *  výchozí tvar skládá, žádný use case si `crypto.randomUUID()` nevolá sám. */
export function buildCalculationEngineEvent(input: BuildCalculationEngineEventInput): CalculationEngineEvent {
  return {
    eventId: crypto.randomUUID(),
    type: input.type,
    tenantId: input.tenantId,
    siteId: input.siteId,
    entityId: input.entityId,
    entityVersion: input.entityVersion,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actorId: input.actorId,
    correlationId: input.correlationId ?? crypto.randomUUID(),
  };
}
