/**
 * Doménové události Manufacturing Calculation Engine (AP-MCE-001 Fáze B §13).
 *
 * Existující `@/domain/events/domain-event.ts` (`{ type, aggregateId,
 * occurredAt }`) je záměrně MINIMÁLNÍ a dodnes nemá žádného posluchače (jediný
 * konzument je `RoutingSheet` agregát, který si eventy jen sbírá do
 * `pendingEvents`/`pullEvents()` beze sběrnice/perzistence - viz komentář
 * tamtéž). AP-MCE-001 §13 žádá bohatší, přesně specifikovaný tvar
 * (`eventId`, `tenantId`, `siteId`, `entityId`, `entityVersion`, `occurredAt`,
 * `actorId`, `correlationId`) pro VŠECH 12 událostí tohohle modulu - rozšířit
 * obecný `DomainEvent` na tenhle tvar by změnilo chování pro `RoutingSheet`,
 * který ho nepoužívá a nepotřebuje. Proto `CalculationEngineEvent` je
 * samostatný, modulu vlastní typ, ne rozšíření sdíleného `DomainEvent`.
 */
export type CalculationEngineEventType =
  | "material_profile.created"
  | "material_profile.updated"
  | "material_correction.created"
  | "machine_profile.created"
  | "machine_profile.updated"
  | "machine_correction.created"
  | "tool_profile.created"
  | "tool_profile.updated"
  | "tool_correction.created"
  | "cutting_condition.created"
  | "cutting_condition.updated"
  | "calculation_context.resolved";

export interface CalculationEngineEvent {
  eventId: string;
  type: CalculationEngineEventType;
  tenantId: string;
  siteId?: string;
  entityId: string;
  /** `recordVersion` entity PO akci, která událost vyvolala - `undefined` pro
   *  read-only události bez vlastní verze (`calculation_context.resolved`). */
  entityVersion?: number;
  occurredAt: string;
  /** Kdo akci provedl - appka dnes nemá `TenantContext.requireCurrentUserId`
   *  (grep potvrzuje, že žádný takový port neexistuje), use casy proto
   *  dostávají `actorId` jako explicitní vstup (stejná konvence jako
   *  `OperationCalculationInput.requestedBy` z Fáze A). */
  actorId?: string;
  /** Váže spolu události vzniklé ze stejné uživatelské akce/požadavku (např.
   *  jeden `ResolveCalculationContextUseCase.execute()` může vyvolat víc
   *  událostí) - volající může předat vlastní, jinak se vygeneruje nová. */
  correlationId: string;
}
