import { CalculationSnapshot } from "./types";

/**
 * Immutable projekce vydaného technologického postupu (Krok 4, zadání bod 52) -
 * vytváří ji `ReleaseRoutingSheetUseCase` v okamžiku vydání a ukládá do
 * samostatného store `tpvReleasedRoutingSheetSnapshots`. Obsahuje ČITELNÉ
 * hodnoty (kódy/názvy strojů, kooperací, typů operací) zamrzlé v čase vydání -
 * pozdější přejmenování/deaktivace kmenových dat (Machine, ExternalOperationResource,
 * OperationType) tenhle dokument nezmění (zadání bod 52: "Změna názvu stroje po
 * release nesmí změnit vydaný dokument"). Používá se pro read-only zobrazení
 * vydané revize a budoucí tiskový/PDF výstup (zadání bod 51) - NENÍ to totéž,
 * co živý `RoutingSheet` ve stavu "released" (ten pořád ukazuje AKTUÁLNÍ Machine/
 * ExternalOperationResource přes id, snapshot ukazuje stav v okamžiku vydání).
 */
export interface ReleasedRoutingSheetSnapshot {
  routingSheetId: string;
  tenantId: string;

  partId: string;
  partNumber: string; // Part.cisloVykresu
  drawingRevision?: string; // Part.revizeVykresu
  partName: string;

  revision: number;
  routingSheetName: string;
  routingSheetDescription?: string;

  operations: ReleasedRoutingOperationSnapshot[];

  releasedAt: string; // ISO 8601
  releasedBy?: string;

  schemaVersion: number;
}

export interface ReleasedRoutingOperationSnapshot {
  operationId: string;
  sequence: number;

  operationTypeId?: string;
  operationTypeCode?: string;
  operationTypeName?: string;

  resourceType: "machine" | "external" | "unassigned";
  machineId?: string;
  machineCode?: string;
  machineName?: string;
  externalResourceId?: string;
  externalResourceCode?: string;
  externalResourceName?: string;

  name: string;
  note?: string;

  setupTimeMinutes?: number;
  unitTimeMinutes?: number;
  transferBatchSize?: number;
  calculatedTimeMinutes: number;

  positions: ReleasedOperationPositionSnapshot[];
}

export interface ReleasedOperationPositionSnapshot {
  positionId: string;
  sequence: number;
  name: string;
  activities: ReleasedOperationActivitySnapshot[];
}

export interface ReleasedOperationActivitySnapshot {
  activityId: string;
  sequence: number;
  name: string;
  note?: string;
  toolId?: string;
  toolCode?: string;
  toolName?: string;
  timeMinutes?: number;
  calculationSnapshot?: CalculationSnapshot;
}

export const RELEASED_ROUTING_SHEET_SNAPSHOT_SCHEMA_VERSION = 1;
