import { exportBackup } from "@/lib/backup";
import { tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { MigrationBackupRecord } from "@/infrastructure/persistence/indexeddb/records";
import { fnv1aChecksum } from "../checksum";

/**
 * Zálohuje VŠECHNA stará data před migrací (zadání, bod 14). Znovu nevyužívá
 * žádnou vlastní logiku čtení - volá přímo existující
 * src/lib/backup.ts::exportBackup(), takže žádná duplikace a žádné riziko, že se
 * záloha rozejde s tím, co appka sama umí exportovat/obnovit. Bundle se uloží
 * trvale do nového store `tpvMigrationBackups` (ne jen do paměti prohlížeče) -
 * `downloadBackup()` ze stejného modulu zůstává k dispozici pro ruční export.
 */
export async function runBackupPhase(migrationRunId: string, sourceDbVersion: number): Promise<MigrationBackupRecord> {
  const bundle = await exportBackup();
  const bundleJson = JSON.stringify(bundle);

  const counts: Record<string, number> = {
    customers: bundle.customers.length,
    inquiries: bundle.inquiries.length,
    parts: bundle.parts.length,
    positions: bundle.positions?.length ?? 0,
    partOperationRows: bundle.partOperationRows.length,
    toolRows: bundle.toolRows.length,
    machines: bundle.machines?.length ?? 0,
  };

  const record: MigrationBackupRecord = {
    id: migrationRunId,
    createdAt: Date.now(),
    sourceDbVersion,
    counts,
    checksum: fnv1aChecksum(bundleJson),
    bundleJson,
  };

  await tpvPut("tpvMigrationBackups", record);
  return record;
}
