import { tpvGetAll, tpvDelete, TpvStoreName, tpvGet, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { LegacyMetadata, RoutingSheetRecord, MigrationRunRecord } from "@/infrastructure/persistence/indexeddb/records";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";

const SIMPLE_STORES: TpvStoreName[] = [
  "tpvCustomers",
  "tpvOrders",
  "tpvParts",
  "tpvMachines",
  "tpvMachineCapabilities",
  "tpvTools",
  "tpvToolMachineConditions",
];

/**
 * Rollback (zadání, bod 15) - smaže JEN nová TPV data vzniklá konkrétním
 * migračním během; staré IndexedDB stores se nikdy nedotkne. Seed číselníky
 * (OperationType/ToolType) se nemažou - jsou sdílené/bezpečné a navíc nemají
 * legacy metadata (nejdou k jednomu běhu jednoznačně přiřadit).
 */
export async function rollbackMigrationRun(migrationRunId: string): Promise<Record<string, number>> {
  const deleted: Record<string, number> = {};

  for (const store of SIMPLE_STORES) {
    const records = await tpvGetAll<LegacyMetadata & { id: string }>(store);
    const toDelete = records.filter((r) => r.migrationRunId === migrationRunId);
    for (const record of toDelete) {
      await tpvDelete(store, record.id);
    }
    deleted[store] = toDelete.length;
  }

  const routingSheetRepo = new IndexedDbRoutingSheetRepository();
  const routingSheetRecords = await tpvGetAll<RoutingSheetRecord>("tpvRoutingSheets");
  const routingSheetsToDelete = routingSheetRecords.filter((r) => r.migrationRunId === migrationRunId);
  for (const record of routingSheetsToDelete) {
    await routingSheetRepo.delete(record.id);
  }
  deleted.tpvRoutingSheets = routingSheetsToDelete.length;

  const run = await tpvGet<MigrationRunRecord>("tpvMigrationRuns", migrationRunId);
  if (run) {
    await tpvPut<MigrationRunRecord>("tpvMigrationRuns", { ...run, status: "rolled_back", finishedAt: Date.now() });
  }

  return deleted;
}
