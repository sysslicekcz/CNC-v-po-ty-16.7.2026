import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { Operation } from "@/domain/aggregates/routing-sheet/operation";
import { Position } from "@/domain/aggregates/routing-sheet/position";
import { Activity } from "@/domain/aggregates/routing-sheet/activity";
import { Calculation } from "@/domain/aggregates/routing-sheet/calculation";
import { OperationNumber } from "@/domain/value-objects/operation-number";
import {
  RoutingSheetRecord,
  OperationRecord,
  PositionRecord,
  ActivityRecord,
  CalculationRecord,
} from "../records";
import {
  LegacyStamp,
  sortKeyToRecord,
  sortKeyFromRecord,
  parseEntityStav,
  parseActivityKind,
  parseRoutingSheetStav,
} from "./common";

export interface RoutingSheetRecordSet {
  routingSheet: RoutingSheetRecord;
  operations: OperationRecord[];
  positions: PositionRecord[];
  activities: ActivityRecord[];
  calculations: CalculationRecord[];
}

function calculationToRecord(calculation: Calculation, activityId: string, legacy: LegacyStamp): CalculationRecord {
  return {
    id: calculation.id,
    activityId,
    inputParameters: [...calculation.inputParameters],
    result: calculation.result,
    algorithmVersion: calculation.algorithmVersion,
    snapshot: calculation.snapshot,
    manualCorrection: calculation.manualCorrection,
    calculatedAt: calculation.calculatedAt,
    ...legacy,
  };
}

function calculationFromRecord(record: CalculationRecord): Calculation {
  return Calculation.create({
    id: record.id,
    inputParameters: record.inputParameters,
    result: record.result,
    algorithmVersion: record.algorithmVersion,
    snapshot: record.snapshot,
    manualCorrection: record.manualCorrection,
    calculatedAt: record.calculatedAt,
  });
}

/**
 * Rozloží agregát RoutingSheet do normalizovaných records (zadání, bod 6-7).
 * `legacyStampsByNewId` je volitelná mapa (novéId -> LegacyStamp) - migrace ji
 * naplní deterministickými id, které sama vytvořila, aplikační vrstva při běžném
 * ukládání ji nepoužije vůbec (výchozí prázdná mapa = žádné legacy metadata).
 */
export function routingSheetToRecordSet(
  routingSheet: RoutingSheet,
  legacyStampsByNewId: Map<string, LegacyStamp> = new Map()
): RoutingSheetRecordSet {
  const stampFor = (id: string): LegacyStamp => legacyStampsByNewId.get(id) ?? {};

  const operations: OperationRecord[] = [];
  const positions: PositionRecord[] = [];
  const activities: ActivityRecord[] = [];
  const calculations: CalculationRecord[] = [];

  for (const operation of routingSheet.operationList) {
    operations.push({
      id: operation.id,
      routingSheetId: routingSheet.id,
      operationNumber: operation.operationNumber.value,
      sortKey: sortKeyToRecord(operation.sortKey),
      nazev: operation.nazev,
      stav: operation.stav,
      machineId: operation.machineId,
      externalResourceId: operation.externalResourceId,
      technologickaPoznamka: operation.technologickaPoznamka,
      setupTimeMinutes: operation.setupTimeMinutes,
      unitTimeMinutes: operation.unitTimeMinutes,
      transferBatchSize: operation.transferBatchSize,
      ...stampFor(operation.id),
    });

    for (const position of operation.positionList) {
      positions.push({
        id: position.id,
        operationId: operation.id,
        nazev: position.nazev,
        sortKey: position.sortKey ? sortKeyToRecord(position.sortKey) : undefined,
        ...stampFor(position.id),
      });

      for (const activity of position.activityList) {
        activities.push({
          id: activity.id,
          positionId: position.id,
          operationTypeId: activity.operationTypeId,
          calculationType: activity.calculationType,
          sortKey: sortKeyToRecord(activity.sortKey),
          kind: activity.kind,
          toolId: activity.toolId,
          technologickaPoznamka: activity.technologickaPoznamka,
          stav: activity.stav,
          ...stampFor(activity.id),
        });

        if (activity.calculation) {
          calculations.push(calculationToRecord(activity.calculation, activity.id, stampFor(activity.calculation.id)));
        }
      }
    }
  }

  const routingSheetRecord: RoutingSheetRecord = {
    id: routingSheet.id,
    tenantId: routingSheet.tenantId,
    partId: routingSheet.partId,
    nazev: routingSheet.nazev,
    popis: routingSheet.popis,
    verze: routingSheet.verze,
    stav: routingSheet.stav,
    createdAt: routingSheet.createdAt,
    createdBy: routingSheet.createdBy,
    updatedAt: routingSheet.updatedAt,
    updatedBy: routingSheet.updatedBy,
    isDefault: routingSheet.isDefault,
    previousVersionId: routingSheet.previousVersionId,
    releasedAt: routingSheet.releasedAt,
    releasedBy: routingSheet.releasedBy,
    ...stampFor(routingSheet.id),
  };

  return { routingSheet: routingSheetRecord, operations, positions, activities, calculations };
}

/** Sestaví doménový agregát z normalizovaných records - repository ji volá poté,
 *  co načte root + všechny navazující records podle FK (viz
 *  IndexedDbRoutingSheetRepository.findById). */
export function routingSheetFromRecordSet(recordSet: RoutingSheetRecordSet): RoutingSheet {
  const calculationsByActivityId = new Map<string, Calculation>();
  for (const calcRecord of recordSet.calculations) {
    calculationsByActivityId.set(calcRecord.activityId, calculationFromRecord(calcRecord));
  }

  const activitiesByPositionId = new Map<string, Activity[]>();
  for (const actRecord of recordSet.activities) {
    const activity = Activity.restore(
      {
        id: actRecord.id,
        operationTypeId: actRecord.operationTypeId,
        calculationType: actRecord.calculationType,
        sortKey: sortKeyFromRecord(actRecord.sortKey),
        kind: parseActivityKind(actRecord.kind),
        toolId: actRecord.toolId,
        technologickaPoznamka: actRecord.technologickaPoznamka,
        stav: actRecord.stav ? parseEntityStav(actRecord.stav, "Activity") : undefined,
      },
      calculationsByActivityId.get(actRecord.id)
    );
    const list = activitiesByPositionId.get(actRecord.positionId) ?? [];
    list.push(activity);
    activitiesByPositionId.set(actRecord.positionId, list);
  }

  const positionsByOperationId = new Map<string, Position[]>();
  for (const posRecord of recordSet.positions) {
    const position = Position.restore(
      {
        id: posRecord.id,
        nazev: posRecord.nazev,
        sortKey: posRecord.sortKey ? sortKeyFromRecord(posRecord.sortKey) : undefined,
      },
      activitiesByPositionId.get(posRecord.id) ?? []
    );
    const list = positionsByOperationId.get(posRecord.operationId) ?? [];
    list.push(position);
    positionsByOperationId.set(posRecord.operationId, list);
  }

  const operations: Operation[] = recordSet.operations.map((opRecord) =>
    Operation.restore(
      {
        id: opRecord.id,
        operationNumber: OperationNumber.create(opRecord.operationNumber),
        sortKey: sortKeyFromRecord(opRecord.sortKey),
        nazev: opRecord.nazev,
        stav: parseEntityStav(opRecord.stav, "Operation"),
        machineId: opRecord.machineId,
        externalResourceId: opRecord.externalResourceId,
        technologickaPoznamka: opRecord.technologickaPoznamka,
        setupTimeMinutes: opRecord.setupTimeMinutes,
        unitTimeMinutes: opRecord.unitTimeMinutes,
        transferBatchSize: opRecord.transferBatchSize,
      },
      positionsByOperationId.get(opRecord.id) ?? []
    )
  );

  return RoutingSheet.restore(
    {
      id: recordSet.routingSheet.id,
      tenantId: recordSet.routingSheet.tenantId,
      partId: recordSet.routingSheet.partId,
      nazev: recordSet.routingSheet.nazev,
      popis: recordSet.routingSheet.popis,
      verze: recordSet.routingSheet.verze,
      stav: parseRoutingSheetStav(recordSet.routingSheet.stav),
      createdAt: recordSet.routingSheet.createdAt,
      createdBy: recordSet.routingSheet.createdBy,
      updatedAt: recordSet.routingSheet.updatedAt,
      updatedBy: recordSet.routingSheet.updatedBy,
      isDefault: recordSet.routingSheet.isDefault,
      previousVersionId: recordSet.routingSheet.previousVersionId,
      releasedAt: recordSet.routingSheet.releasedAt,
      releasedBy: recordSet.routingSheet.releasedBy,
    },
    operations
  );
}
