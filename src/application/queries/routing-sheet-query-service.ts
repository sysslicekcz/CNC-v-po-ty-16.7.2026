/**
 * Read-only projekce pro budoucí UI výpisy (CQRS-lite - jen oddělení "write
 * aggregate" / "read projection", žádný message bus, command bus ani event
 * sourcing - viz zadání, bod 14 a docs/adr/0009).
 */

export interface RoutingSheetListItem {
  id: string;
  partId: string;
  nazev: string;
  verze: string;
  stav: string;
  operationCount: number;
}

export interface OperationSummary {
  id: string;
  operationNumber: number;
  nazev: string;
  machineId?: string;
  machineName?: string;
  finalTime: number;
}

export interface RoutingSheetSummary {
  id: string;
  partId: string;
  nazev: string;
  verze: string;
  stav: string;
  operations: OperationSummary[];
  totalTime: number;
}

export interface RoutingSheetQueryService {
  getSummary(id: string): Promise<RoutingSheetSummary | null>;
  listByPartId(partId: string): Promise<RoutingSheetListItem[]>;
}
