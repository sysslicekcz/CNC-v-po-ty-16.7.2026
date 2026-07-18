import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Operation } from "@/domain/aggregates/routing-sheet/operation";
import { Position } from "@/domain/aggregates/routing-sheet/position";
import { Activity } from "@/domain/aggregates/routing-sheet/activity";
import { Part } from "@/domain/entities/part";
import { Machine } from "@/domain/entities/machine";
import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { OperationType } from "@/domain/entities/operation-type";
import { Tool } from "@/domain/entities/tool";
import {
  RoutingSheetEditorDto,
  RoutingOperationEditorDto,
  OperationPositionEditorDto,
  OperationActivityEditorDto,
  OperationExternalReferenceInfo,
} from "./dto/routing-sheet-editor-dto";
import { RoutingValidationIssueDto } from "./dto/routing-validation-issue-dto";

/** Předem natažené číselníky/kmenová data potřebná k sestavení editor DTO -
 *  natažené DÁVKOVĚ (zadání bod 48 - "načti potřebné číselníky dávkově"),
 *  ne dotazem za každý řádek zvlášť. `GetRoutingSheetEditorUseCase` je sestaví
 *  jedním průchodem přes repozitáře, tenhle soubor je jen čistá, testovatelná
 *  transformace (zadání bod 45 - "mappery musí být testovatelné"). */
export interface RoutingSheetEditorLookups {
  machinesById: Map<string, Machine>;
  externalResourcesById: Map<string, ExternalOperationResource>;
  operationTypesById: Map<string, OperationType>;
  toolsById: Map<string, Tool>;
  /** Klíč: Operation.id -> lidsky čitelné externí reference (Krok 4, bod 54). */
  externalReferencesByOperationId?: Map<string, OperationExternalReferenceInfo[]>;
}

export function toRoutingSheetEditorDto(
  routingSheet: RoutingSheet,
  part: Part,
  lookups: RoutingSheetEditorLookups,
  validationIssues: RoutingValidationIssueDto[] = []
): RoutingSheetEditorDto {
  return {
    id: routingSheet.id,
    tenantId: routingSheet.tenantId,
    partId: routingSheet.partId,
    partNumber: part.cisloVykresu ?? "",
    drawingRevision: part.revizeVykresu,
    partName: part.nazev,
    revision: routingSheet.revisionNumber,
    status: routingSheet.stav,
    sourceRoutingSheetId: routingSheet.previousVersionId,
    name: routingSheet.nazev,
    description: routingSheet.popis ?? "",
    createdAt: new Date(routingSheet.createdAt).toISOString(),
    createdBy: routingSheet.createdBy,
    updatedAt: routingSheet.updatedAt ? new Date(routingSheet.updatedAt).toISOString() : undefined,
    updatedBy: routingSheet.updatedBy,
    releasedAt: routingSheet.releasedAt ? new Date(routingSheet.releasedAt).toISOString() : undefined,
    releasedBy: routingSheet.releasedBy,
    operations: routingSheet.operationList.map((operation) => toOperationEditorDto(operation, lookups)),
    validationIssues,
    dirty: false,
  };
}

function toOperationEditorDto(operation: Operation, lookups: RoutingSheetEditorLookups): RoutingOperationEditorDto {
  const assignment = operation.resourceAssignment;
  const machine = assignment.type === "machine" ? lookups.machinesById.get(assignment.machineId) : undefined;
  const externalResource =
    assignment.type === "external" ? lookups.externalResourcesById.get(assignment.externalResourceId) : undefined;

  return {
    id: operation.id,
    sequence: operation.operationNumber.value,
    resourceType: assignment.type,
    machineId: assignment.type === "machine" ? assignment.machineId : undefined,
    machineCode: machine?.code.toString(),
    machineName: machine?.name,
    machineInactive: machine ? machine.status !== "active" : assignment.type === "machine" ? true : undefined,
    externalResourceId: assignment.type === "external" ? assignment.externalResourceId : undefined,
    externalResourceCode: externalResource?.code.toString(),
    externalResourceName: externalResource?.name,
    externalResourceInactive: externalResource
      ? externalResource.status !== "active"
      : assignment.type === "external"
        ? true
        : undefined,
    name: operation.nazev,
    note: operation.technologickaPoznamka,
    setupTimeMinutes: operation.setupTimeMinutes,
    unitTimeMinutes: operation.unitTimeMinutes,
    transferBatchSize: operation.transferBatchSize,
    calculatedTimeMinutes: operation.finalTime,
    positions: operation.positionList.map((position, index) =>
      toPositionEditorDto(position, index, lookups, assignment.type === "machine" ? assignment.machineId : undefined)
    ),
    externalReferences: lookups.externalReferencesByOperationId?.get(operation.id),
  };
}

function toPositionEditorDto(
  position: Position,
  index: number,
  lookups: RoutingSheetEditorLookups,
  currentMachineId: string | undefined
): OperationPositionEditorDto {
  return {
    id: position.id,
    sequence: index + 1,
    name: position.nazev,
    activities: position.activityList.map((activity, activityIndex) =>
      toActivityEditorDto(activity, activityIndex, lookups, currentMachineId)
    ),
  };
}

function toActivityEditorDto(
  activity: Activity,
  index: number,
  lookups: RoutingSheetEditorLookups,
  currentMachineId: string | undefined
): OperationActivityEditorDto {
  const operationType = lookups.operationTypesById.get(activity.operationTypeId);
  const tool = activity.toolId ? lookups.toolsById.get(activity.toolId) : undefined;
  const calculation = activity.calculation;

  // Zastaralost kalkulace (zadání bod 23) - jen signály odvoditelné z uloženého
  // stavu (změna stroje/nástroje od okamžiku výpočtu). Změna vstupních
  // parametrů (materiál/rozměry/řezné podmínky) se sleduje v editor state,
  // dokud se ještě needituje - viz docs/step-4/calculations.md.
  const staleByResourceChange = Boolean(
    calculation &&
      ((calculation.snapshot.machineId ?? undefined) !== (currentMachineId ?? undefined) ||
        (calculation.snapshot.toolId ?? undefined) !== (activity.toolId ?? undefined))
  );

  return {
    id: activity.id,
    sequence: index + 1,
    kind: activity.kind,
    operationTypeId: activity.operationTypeId,
    operationTypeCode: operationType?.kod,
    operationTypeName: operationType?.nazev,
    toolId: activity.toolId,
    toolCode: tool?.code?.toString(),
    toolName: tool?.nazev,
    note: activity.technologickaPoznamka,
    timeMinutes: calculation?.finalTime,
    manualCorrectionMinutes: calculation?.manualCorrection,
    calculationId: calculation?.id,
    calculationSnapshot: calculation?.snapshot,
    calculationResult: calculation?.result,
    calculationInputParameters: calculation ? [...calculation.inputParameters] : undefined,
    calculationStaleByResourceChange: staleByResourceChange,
  };
}
