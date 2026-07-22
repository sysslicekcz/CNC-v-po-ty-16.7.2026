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
  | "calculation_context.resolved"
  // AP-MCE-001 Fáze C §16 - `entityId` u těchto šesti nese `calculationId`
  // (= `CalculationRequest.id`/`CalculationResult.id`), `entityVersion` nese
  // revizi výsledku (`CalculationResult` se nikdy nepřepisuje, přepočet
  // vytváří novou revizi - viz `strategyVersion` pole níž).
  | "turning_calculation.requested"
  | "turning_calculation.completed"
  | "turning_calculation.failed"
  | "turning_calculation.recalculated"
  | "turning_machine_comparison.completed"
  | "turning_tool_comparison.completed"
  // AP-MCE-001 Fáze D §17 - stejná role jako turning ekvivalenty výš.
  | "milling_calculation.requested"
  | "milling_calculation.completed"
  | "milling_calculation.failed"
  | "milling_calculation.recalculated"
  | "milling_machine_comparison.completed"
  | "milling_tool_comparison.completed"
  // AP-MCE-001 Fáze E §19 - stejná role jako turning/milling ekvivalenty výš,
  // plus dvě UDÁLOSTI SPECIFICKÉ pro broušení (`wheel_dressing.planned`/
  // `wheel_replacement.planned` - orovnání a výměna kotouče jsou dvě ODLIŠNÉ
  // věci, §7/§8 "Orovnání nesmí být zaměněno za výměnu kotouče", proto mají i
  // ODDĚLENÉ události, ne jednu společnou).
  | "grinding_calculation.requested"
  | "grinding_calculation.completed"
  | "grinding_calculation.failed"
  | "grinding_calculation.recalculated"
  | "grinding_machine_comparison.completed"
  | "grinding_wheel_comparison.completed"
  | "wheel_dressing.planned"
  | "wheel_replacement.planned"
  // AP-MCE-001 Fáze F §19 - PŘESNĚ 11 událostí ze zadání. `manual_calculation.*`/
  // `inspection_calculation.*` mají stejnou roli jako `turning_calculation.*`
  // (včetně `.recalculated`, na rozdíl od dřívějšího návrhu tuhle fázi
  // NEzjednodušuje - zadání ho chce explicitně). `manual_standard.selected`/
  // `inspection_equipment.selected`/`inspection_sampling.resolved` NEJSOU
  // CRUD události (na rozdíl od Fáze B `material_profile.created/updated`) -
  // vyvolávají se PŘI VÝPOČTU, když `Calculate*OperationUseCase` zjistí, který
  // konkrétní standard/vybavení/sampling plán se pro tenhle výsledek skutečně
  // použil (auditní stopa §18 "jaký vzorkovací plán vedl k jakému výsledku").
  | "manual_calculation.requested"
  | "manual_calculation.completed"
  | "manual_calculation.failed"
  | "manual_calculation.recalculated"
  | "inspection_calculation.requested"
  | "inspection_calculation.completed"
  | "inspection_calculation.failed"
  | "inspection_calculation.recalculated"
  | "manual_standard.selected"
  | "inspection_sampling.resolved"
  | "inspection_equipment.selected"
  // AP-MCE-001 Fáze G §25 - PŘESNĚ 20 událostí ze zadání, tři oblasti:
  // skutečné časy (`actual_time.*`), analýza odchylek (`variance.*`/
  // `variance_cause.*`) a kalibrace (`calibration_*`).
  // `calibration_profile.activated`/`.superseded` mají stejnou roli jako
  // `tool_profile.created`/`.updated` (Fáze B) - verzovaná entita, ne CRUD
  // pár, protože `CalibrationProfile` se nikdy needituje na místě (§13/§18
  // "ochrana proti retroaktivní změně").
  | "actual_time.created"
  | "actual_time.updated"
  | "actual_time.imported"
  | "actual_time.validated"
  | "actual_time.approved"
  | "actual_time.matched"
  | "actual_time.match_failed"
  | "variance.analysis_completed"
  | "variance.high_detected"
  | "variance_cause.suggested"
  | "variance_cause.confirmed"
  | "calibration_samples.created"
  | "calibration_outliers.detected"
  | "calibration_proposal.generated"
  | "calibration_proposal.backtested"
  | "calibration_proposal.reviewed"
  | "calibration_proposal.approved"
  | "calibration_profile.activated"
  | "calibration_profile.superseded"
  | "calibration_shadow.completed";

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
  /** AP-MCE-001 Fáze C §16 - verze VÝPOČETNÍ LOGIKY strategie, která
   *  událost vyvolala (`TurningCalculationStrategy.strategyVersion`,
   *  "turning-1.0.0") - `undefined` pro události, které se strategií
   *  nesouvisí (profily, korekce, `calculation_context.resolved`). */
  strategyVersion?: string;
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
