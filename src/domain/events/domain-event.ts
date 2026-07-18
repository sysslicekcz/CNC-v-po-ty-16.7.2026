/** Kontrakt pro budoucí doménové události (report v3, bod 5) - "collect and dispatch
 *  after commit": Aggregate Root sbírá pendingEvents, Application vrstva je po
 *  úspěšném uložení vyzvedne (pullEvents()) a rozešle dál (budoucí AuditLog, ERP
 *  synchronizace, přepočet odvozených hodnot). Dnes žádný listener neexistuje -
 *  jde jen o rezervaci místa v architektuře, aby pozdější přidání nevyžadovalo
 *  zásah do existujících agregátů. */

export interface DomainEventBase {
  aggregateId: string;
  occurredAt: number;
}

export type DomainEvent =
  | (DomainEventBase & { type: "OperationAdded"; operationId: string })
  | (DomainEventBase & { type: "ResourceAssignedToOperation"; operationId: string; resourceId: string | undefined })
  | (DomainEventBase & { type: "ToolAssignedToActivity"; activityId: string; toolId: string | undefined })
  | (DomainEventBase & { type: "CalculationRun"; activityId: string; calculationId: string })
  | (DomainEventBase & { type: "RoutingSheetReleased"; verze: string })
  | (DomainEventBase & { type: "RoutingSheetRevised"; previousVersionId: string; verze: string });
