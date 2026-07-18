import { RoutingSheet } from "../entities/routing-sheet";

/** Write path pro celý strom RoutingSheet -> Operation -> Position -> Activity ->
 *  Calculation. `save()` ukládá agregát atomicky (jedna transakce v infrastruktuře) -
 *  žádné vnitřní entity nemají vlastní zápisové repozitáře (viz report v3, bod 1). */
export interface RoutingSheetRepository {
  findById(id: string): Promise<RoutingSheet | null>;
  findByPartId(partId: string): Promise<RoutingSheet[]>;
  save(routingSheet: RoutingSheet): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Lehká projekce pro UI seznamy operací, aby nebylo nutné kvůli výpisu tahat
 *  vždycky celý agregát (CQRS-lite, jen čtení, nikdy zápis - viz report, riziko #1). */
export interface OperationSummary {
  id: string;
  routingSheetId: string;
  operationNumber: number;
  nazev: string;
  resourceId?: string;
  resourceNazev?: string;
  finalTime: number;
}

export interface OperationQueryRepository {
  listByRoutingSheetId(routingSheetId: string): Promise<OperationSummary[]>;
}
