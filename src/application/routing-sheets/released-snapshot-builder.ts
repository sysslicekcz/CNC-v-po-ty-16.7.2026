import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Part } from "@/domain/entities/part";
import {
  ReleasedRoutingSheetSnapshot,
  ReleasedRoutingOperationSnapshot,
  RELEASED_ROUTING_SHEET_SNAPSHOT_SCHEMA_VERSION,
} from "@/domain/aggregates/routing-sheet/released-snapshot";
import { RoutingSheetEditorLookups } from "./routing-sheet-editor-mapper";

/** Sestaví immutable release projekci (zadání bod 52) z aktuálního stavu
 *  agregátu + kmenových dat V OKAMŽIKU VYDÁNÍ - volá ho výhradně
 *  `ReleaseRoutingSheetUseCase`, nikdy se znovu nepřepočítává (žádný "refresh"
 *  operace na uloženém snapshotu by porušil immutabilitu). */
export function buildReleasedRoutingSheetSnapshot(
  routingSheet: RoutingSheet,
  part: Part,
  lookups: RoutingSheetEditorLookups,
  releasedAt: Date,
  releasedBy: string | undefined
): ReleasedRoutingSheetSnapshot {
  return {
    routingSheetId: routingSheet.id,
    tenantId: routingSheet.tenantId,
    partId: routingSheet.partId,
    partNumber: part.cisloVykresu ?? "",
    drawingRevision: part.revizeVykresu,
    partName: part.nazev,
    revision: routingSheet.revisionNumber,
    routingSheetName: routingSheet.nazev,
    routingSheetDescription: routingSheet.popis,
    operations: routingSheet.operationList.map((operation): ReleasedRoutingOperationSnapshot => {
      const assignment = operation.resourceAssignment;
      const machine = assignment.type === "machine" ? lookups.machinesById.get(assignment.machineId) : undefined;
      const externalResource =
        assignment.type === "external" ? lookups.externalResourcesById.get(assignment.externalResourceId) : undefined;

      return {
        operationId: operation.id,
        sequence: operation.operationNumber.value,
        resourceType: assignment.type,
        machineId: assignment.type === "machine" ? assignment.machineId : undefined,
        machineCode: machine?.code.toString(),
        machineName: machine?.name,
        externalResourceId: assignment.type === "external" ? assignment.externalResourceId : undefined,
        externalResourceCode: externalResource?.code.toString(),
        externalResourceName: externalResource?.name,
        name: operation.nazev,
        note: operation.technologickaPoznamka,
        setupTimeMinutes: operation.setupTimeMinutes,
        unitTimeMinutes: operation.unitTimeMinutes,
        transferBatchSize: operation.transferBatchSize,
        calculatedTimeMinutes: operation.finalTime,
        positions: operation.positionList.map((position, positionIndex) => ({
          positionId: position.id,
          sequence: positionIndex + 1,
          name: position.nazev,
          activities: position.activityList.map((activity, activityIndex) => {
            const operationType = lookups.operationTypesById.get(activity.operationTypeId);
            const tool = activity.toolId ? lookups.toolsById.get(activity.toolId) : undefined;
            return {
              activityId: activity.id,
              sequence: activityIndex + 1,
              name: operationType?.nazev ?? activity.operationTypeId,
              note: activity.technologickaPoznamka,
              toolId: activity.toolId,
              toolCode: tool?.code?.toString(),
              toolName: tool?.nazev,
              timeMinutes: activity.calculation?.finalTime,
              calculationSnapshot: activity.calculation?.snapshot,
            };
          }),
        })),
      };
    }),
    releasedAt: releasedAt.toISOString(),
    releasedBy,
    schemaVersion: RELEASED_ROUTING_SHEET_SNAPSHOT_SCHEMA_VERSION,
  };
}
