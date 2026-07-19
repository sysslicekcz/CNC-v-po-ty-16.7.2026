import { RoutingSheetStav } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { ActivityKind, CalculationSnapshot, CalcOutput, CalculationInputRow } from "@/domain/aggregates/routing-sheet/types";
import { RoutingValidationIssueDto } from "./routing-validation-issue-dto";

/**
 * Editorový model (Krok 4, zadání bod 13) - UI nikdy nemutuje doménovou entitu
 * ani IndexedDB record přímo, jen tenhle DTO strom. Obsahuje zobrazovací
 * hodnoty dopočítané z číselníků (kód/název stroje, kooperace, typu operace,
 * nástroje) vedle interních id, aby komponenty nemusely dotazovat repository
 * samostatně za každý řádek (zadání bod 48 - "žádné samostatné DB dotazy pro
 * každý stroj v seznamu"). Převod DTO -> doména/persistence vždy prochází přes
 * mapper + application use case (viz `routing-sheet-editor-mapper.ts`,
 * `SaveRoutingSheetDraftUseCase`), nikdy přímo z komponenty.
 */
export interface RoutingSheetEditorDto {
  id?: string;
  tenantId: string;
  partId: string;

  partNumber: string;
  drawingRevision?: string;
  partName: string;

  revision: number;
  status: RoutingSheetStav;
  sourceRoutingSheetId?: string;

  name: string;
  description: string;

  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  releasedAt?: string;
  releasedBy?: string;

  operations: RoutingOperationEditorDto[];

  validationIssues: RoutingValidationIssueDto[];
  dirty: boolean;
}

export type OperationResourceType = "machine" | "external" | "unassigned";

export interface RoutingOperationEditorDto {
  id: string;
  sequence: number; // operationNumber (10, 20, 30, ...)

  operationTypeId?: string;

  resourceType: OperationResourceType;

  machineId?: string;
  machineCode?: string;
  machineName?: string;
  machineInactive?: boolean;

  externalResourceId?: string;
  externalResourceCode?: string;
  externalResourceName?: string;
  externalResourceInactive?: boolean;

  name: string;
  note?: string;

  setupTimeMinutes?: number;
  unitTimeMinutes?: number;
  transferBatchSize?: number;
  /** Odvozený součet Activity.calculation.finalTime - viz Operation.finalTime. */
  calculatedTimeMinutes: number;

  positions: OperationPositionEditorDto[];

  /** Externí reference (Krok 3.5 dodatek) - jen informativní zobrazení (zadání
   *  Krok 4, bod 54), nikdy hlavní identifikátor operace a nikdy editovatelné
   *  přímo z tohohle editoru. */
  externalReferences?: OperationExternalReferenceInfo[];
}

export interface OperationExternalReferenceInfo {
  externalSystemName: string;
  externalEntityType: string;
  externalId?: string;
  externalCode?: string;
}

export interface OperationPositionEditorDto {
  id: string;
  sequence: number;
  name: string;
  activities: OperationActivityEditorDto[];
}

export interface OperationActivityEditorDto {
  id: string;
  sequence: number;
  kind: ActivityKind;

  operationTypeId: string;
  operationTypeCode?: string;
  /** Zobrazovací název - odvozený z OperationType.nazev (Activity sama žádné
   *  jméno neukládá, viz docs/audits/step-4-audit.md). */
  operationTypeName?: string;

  toolId?: string;
  toolCode?: string;
  toolName?: string;

  note?: string;

  timeMinutes?: number;
  manualCorrectionMinutes?: number;

  calculationId?: string;
  calculationSnapshot?: CalculationSnapshot;
  calculationResult?: CalcOutput;
  calculationInputParameters?: CalculationInputRow[];
  /** `true`, pokud `calculationSnapshot.machineId`/`toolId` neodpovídá
   *  AKTUÁLNÍMU přiřazení stroje/nástroje (zadání bod 23) - vstupní parametry
   *  (materiál/rozměry/...) editor sleduje odděleně v editor state, protože to
   *  je jen dočasná session hodnota, ne odvoditelná z uloženého DTO samotného
   *  (viz docs/step-4/calculations.md). */
  calculationStaleByResourceChange: boolean;
}
