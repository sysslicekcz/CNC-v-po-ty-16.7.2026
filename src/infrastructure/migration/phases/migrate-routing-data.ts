import { RoutingSheet } from "@/domain/aggregates/routing-sheet/routing-sheet";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { routingSheetToRecordSet } from "@/infrastructure/persistence/indexeddb/mappers/routing-sheet-mapper";
import { LegacyStamp } from "@/infrastructure/persistence/indexeddb/mappers/common";
import { LegacySourceData, LegacyPartOperationRowsRecord } from "../legacy-source";
import { MigrationContext } from "../context";
import { deterministicId } from "../id-mapping";
import { UNKNOWN_OPERATION_TYPE_ID } from "./seed-reference-data";

const LEGACY_SOURCE_POSITIONS = "positions";
const LEGACY_SOURCE_ROWS = "partOperationRows";

/**
 * parts -> RoutingSheet (1 výchozí na díl), positions -> Operation + Position
 * (1:1, BEZ seskupování podle opId), partOperationRows -> Activity (zadání,
 * bod 4 - "Operation a Position"). Klíčové pravidlo: každá stará Position
 * vytvoří VLASTNÍ Operation a VLASTNÍ Position - nikdy se neslučuje podle
 * `strojId` ani `opId` (viz docs/adr/0013).
 *
 * `partOperationRows.partId` je ve skutečnosti legacyPositionId (viz audit) -
 * tahle fáze na to spoléhá při párování řádků na jejich pozici.
 *
 * Calculation se pro migrovaná data NEVYTVÁŘÍ - legacy appka výsledek nikdy
 * neukládala (počítala ho jen za běhu), takže by šlo o fabrikovaný výsledek.
 * Vstupní řádky (`rows`) se zachovají v `ActivityRecord.legacyInputParameters`
 * (persistence-only pole, doména Activity ho nezná) - podklad pro budoucí
 * explicitní přepočet, ne automatický (docs/migrations/tpv-v1-to-v2.md).
 */
export async function runMigrateRoutingDataPhase(
  data: LegacySourceData,
  routingSheetRepository: IndexedDbRoutingSheetRepository,
  context: MigrationContext
): Promise<void> {
  const positionsByPartId = new Map<string, typeof data.positions>();
  for (const position of data.positions) {
    const list = positionsByPartId.get(position.partId) ?? [];
    list.push(position);
    positionsByPartId.set(position.partId, list);
  }

  const rowsByLegacyPositionId = new Map<string, LegacyPartOperationRowsRecord[]>();
  for (const row of data.partOperationRows) {
    const list = rowsByLegacyPositionId.get(row.partId) ?? [];
    list.push(row);
    rowsByLegacyPositionId.set(row.partId, list);
  }

  for (const [legacyPartId, newPartId] of context.partIdMap) {
    const routingSheetId = deterministicId("routing-sheet", legacyPartId);

    // Bezpečný opakovaný běh (Krok 4): dřív se sem vždycky zapsal ČERSTVÝ
    // draft bez ohledu na to, co s ním technolog mezitím udělal (vydal,
    // archivoval, založil další revize) - deterministické ID sice dovolovalo
    // najít "tu samou" RoutingSheet napříč běhy, ale bezpodmínečné přepsání by
    // při dalším běhu migrace tiše zahodilo celou revizní historii vzniklou
    // v editoru (porušení "žádné destruktivní migrace"). Pokud pro díl už
    // RoutingSheet existuje, migrace ji nechá být - nepřidá ji do
    // `routingSheetIdMap`, takže ji ani `post-validation` nebude porovnávat
    // proti (možná už neaktuálním) legacy datům.
    const existing = await routingSheetRepository.findById(routingSheetId, DEFAULT_TENANT_ID);
    if (existing) {
      context.incrementCounter("skipped", "routingSheets");
      context.addIssue({
        severity: "info",
        phase: "migrate-routing-data",
        code: "routing-sheet-already-migrated",
        message: `Technologický postup pro díl (legacy "${legacyPartId}") už existuje - migrace ho nepřepsala.`,
        legacySource: "parts",
        legacyId: legacyPartId,
      });
      continue;
    }

    const routingSheet = RoutingSheet.create({
      id: routingSheetId,
      tenantId: DEFAULT_TENANT_ID,
      partId: newPartId,
      nazev: "Výchozí technologický postup",
      verze: "1",
      stav: "draft",
      isDefault: true,
      createdAt: Date.now(),
    });
    context.routingSheetIdMap.set(legacyPartId, routingSheetId);

    const stamps = new Map<string, LegacyStamp>();
    stamps.set(routingSheetId, { legacySource: "parts", legacyId: legacyPartId, migrationRunId: context.migrationRunId });
    context.incrementCounter("created", "routingSheets");

    const legacyPositions = [...(positionsByPartId.get(legacyPartId) ?? [])].sort(
      (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
    );

    // legacyInputParameters se do domain Activity zapsat nedá (persistence-only
    // pole) - patchuje se do ActivityRecord až po převodu agregátu na record set níže.
    const legacyInputParametersByNewActivityId = new Map<string, LegacyPartOperationRowsRecord["rows"]>();

    for (const legacyPosition of legacyPositions) {
      const machineId = legacyPosition.strojId ? context.machineIdMap.get(legacyPosition.strojId) : undefined;
      if (legacyPosition.strojId && !machineId) {
        context.addIssue({
          severity: "warning",
          phase: "migrate-routing-data",
          code: "operation-missing-machine",
          message: `Operace vzniklá z polohy "${legacyPosition.id}" nemá stroj - "${legacyPosition.strojId}" nebyl migrován.`,
          legacySource: LEGACY_SOURCE_POSITIONS,
          legacyId: legacyPosition.id,
        });
      }

      const operationId = deterministicId("operation", legacyPosition.id);
      const positionId = deterministicId("position", legacyPosition.id);
      context.operationIdByLegacyPositionId.set(legacyPosition.id, operationId);
      context.positionIdByLegacyPositionId.set(legacyPosition.id, positionId);

      routingSheet.addOperation({
        id: operationId,
        nazev: legacyPosition.nazev || "Operace",
        machineId,
      });
      routingSheet.addPosition(operationId, { id: positionId, nazev: "Upnutí 1" });

      stamps.set(operationId, {
        legacySource: LEGACY_SOURCE_POSITIONS,
        legacyId: legacyPosition.id,
        migrationRunId: context.migrationRunId,
      });
      stamps.set(positionId, {
        legacySource: LEGACY_SOURCE_POSITIONS,
        legacyId: legacyPosition.id,
        migrationRunId: context.migrationRunId,
      });
      context.incrementCounter("created", "operations");
      context.incrementCounter("created", "positions");

      const legacyRows = [...(rowsByLegacyPositionId.get(legacyPosition.id) ?? [])].sort((a, b) =>
        a.id.localeCompare(b.id)
      );

      for (const row of legacyRows) {
        const operationTypeId = context.opIdToOperationTypeId.get(row.opId);
        if (!operationTypeId) {
          context.addIssue({
            severity: "warning",
            phase: "migrate-routing-data",
            code: "activity-unknown-op-id-fallback",
            message: `Operační řádky "${row.id}" mají neznámý opId "${row.opId}" - Activity vznikla s fallback klasifikací.`,
            legacySource: LEGACY_SOURCE_ROWS,
            legacyId: row.id,
          });
        }

        const activityId = deterministicId("activity", row.id);
        const activity = routingSheet.addActivity(operationId, positionId, {
          id: activityId,
          operationTypeId: operationTypeId ?? UNKNOWN_OPERATION_TYPE_ID,
          calculationType: row.opId,
          kind: "calculation",
        });

        stamps.set(activityId, {
          legacySource: LEGACY_SOURCE_ROWS,
          legacyId: row.id,
          migrationRunId: context.migrationRunId,
        });
        legacyInputParametersByNewActivityId.set(activity.id, row.rows);
        context.incrementCounter("created", "activities");
      }
    }

    const recordSet = routingSheetToRecordSet(routingSheet, stamps);
    for (const activityRecord of recordSet.activities) {
      const legacyRows = legacyInputParametersByNewActivityId.get(activityRecord.id);
      if (legacyRows && legacyRows.length > 0) {
        activityRecord.legacyInputParameters = legacyRows;
      }
    }

    await routingSheetRepository.saveRecordSet(recordSet);
  }
}
