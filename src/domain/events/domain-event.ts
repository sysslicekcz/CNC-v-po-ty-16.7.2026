/** Minimální kontrakt pro budoucí doménové události - viz docs/adr/0009 a zadání
 *  Krok 2, bod 15. V tomto kroku záměrně žádný dispatcher, event bus ani listener -
 *  jen typ a `RoutingSheet.pullEvents()`, aby pozdější přidání nevyžadovalo zásah
 *  do existujících agregátů. */
export interface DomainEvent {
  type: string;
  aggregateId: string;
  occurredAt: Date;
}
