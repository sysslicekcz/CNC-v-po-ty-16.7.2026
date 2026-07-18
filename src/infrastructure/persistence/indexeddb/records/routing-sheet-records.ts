import { LegacyMetadata } from "./legacy-metadata";

/**
 * Normalizované persistence records pro RoutingSheet agregát (zadání, bod 6-7).
 * Doména stále pracuje s jedním agregátem (RoutingSheet), perzistence je ale
 * rozdělená do víc stores - IndexedDbRoutingSheetRepository je sestaví/rozloží.
 *
 * Pole `routingSheetId`/`operationId`/`positionId`/`activityId` na Operation/
 * Position/Activity/Calculation records jsou perzistenční FK potřebné pro indexy -
 * doménové entity je nemají (vztah je dán vnořením ve stromu, ne FK, viz Krok 2).
 */

export interface RoutingSheetRecord extends LegacyMetadata {
  id: string;
  partId: string;
  nazev: string;
  verze: string;
  stav: string;
  createdAt: number;
  updatedAt?: number;
  isDefault?: boolean;
  previousVersionId?: string;
  releasedAt?: number;
}

export interface OperationRecord extends LegacyMetadata {
  id: string;
  routingSheetId: string;
  operationNumber: number;
  sortKey: string;
  nazev: string;
  stav: string;
  machineId?: string;
  technologickaPoznamka?: string;
}

export interface PositionRecord extends LegacyMetadata {
  id: string;
  operationId: string;
  nazev: string;
  sortKey?: string;
}

export type CalculationInputRowRecord = Record<string, string | number | null>;

export interface ActivityRecord extends LegacyMetadata {
  id: string;
  positionId: string;
  operationTypeId: string;
  calculationType: string;
  sortKey: string;
  kind: string;
  toolId?: string;
  technologickaPoznamka?: string;
  stav?: string;
  /**
   * Legacy vstupní řádky zachované migrací, když stará data neobsahovala žádný
   * uložený výsledek (appka ho vždy počítala jen za běhu - viz audit Krok 3).
   * Existuje jen v perzistenci, doména Activity tohle pole nemá - domain mapper
   * ho při čtení ignoruje. Slouží jako podklad pro budoucí explicitní přepočet
   * (RunCalculationUseCase), ne jako fabrikovaný výsledek. Viz
   * docs/migrations/tpv-v1-to-v2.md.
   */
  legacyInputParameters?: CalculationInputRowRecord[];
}

export interface OpResultRecord {
  label: string;
  kontura: string;
  cas: number | null;
  note?: string;
}

export interface CalcOutputRecord {
  rows: OpResultRecord[];
  total: number;
}

export interface CalculationSnapshotRecord {
  machineId?: string;
  machineName?: string;
  machineHourlyRate?: { amount: number; currency: string };
  toolId?: string;
  toolName?: string;
  toolTypeId?: string;
  operationTypeId: string;
  operationTypeCode: string;
  cuttingParameters?: { vc?: number; feed?: number; ap?: number };
  calculatedAt: string;
  applicationVersion?: string;
  calculationEngineVersion: string;
  gitCommit?: string;
}

export interface CalculationRecord extends LegacyMetadata {
  id: string;
  activityId: string;
  inputParameters: CalculationInputRowRecord[];
  result: CalcOutputRecord;
  algorithmVersion: string;
  snapshot: CalculationSnapshotRecord;
  manualCorrection?: number;
  calculatedAt?: number;
}
