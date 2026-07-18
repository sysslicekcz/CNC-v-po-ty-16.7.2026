import { tpvGetAll, tpvGet, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { MigrationRunRecord, emptyMigrationCounters } from "@/infrastructure/persistence/indexeddb/records";
import { IndexedDbCustomerRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-customer-repository";
import { IndexedDbOrderRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-order-repository";
import { IndexedDbPartRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-part-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbMachineCapabilityRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-capability-repository";
import { IndexedDbOperationTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-operation-type-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbToolMachineConditionRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-machine-condition-repository";
import { IndexedDbRoutingSheetRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-routing-sheet-repository";
import { readLegacySourceData, LegacySourceData } from "./legacy-source";
import { MigrationContext } from "./context";
import { runPreflightValidation } from "./phases/preflight";
import { runBackupPhase } from "./phases/backup";
import { runSeedReferenceDataPhase, TOOL_TYPE_FALLBACK_ID } from "./phases/seed-reference-data";
import { runMigrateMasterDataPhase } from "./phases/migrate-master-data";
import { runMigrateMachinesPhase } from "./phases/migrate-machines";
import { runMigrateToolsPhase } from "./phases/migrate-tools";
import { runMigrateRoutingDataPhase } from "./phases/migrate-routing-data";
import { runPostValidationPhase } from "./phases/post-validation";
import { buildReportFromCounters, MigrationReport } from "./types";

const MIGRATION_VERSION = "tpv-v1-to-v2:1";
const SOURCE_DB_VERSION = 4; // src/lib/db.ts DB_VERSION v okamžiku vzniku Kroku 3
const TARGET_DB_VERSION = 1; // cnc-tpv DB_VERSION

function newMigrationRunId(): string {
  return `migration-run:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

async function saveRun(run: MigrationRunRecord): Promise<void> {
  await tpvPut("tpvMigrationRuns", run);
}

/** Krok 11 ze zadání - pokud minulý běh spadl uprostřed (status zůstal
 *  "running"), nepokračuje se v něm slepě. Označí se jako neúspěšný a spustí se
 *  nový běh - díky deterministickým id a `put()` upsertu je to bezpečné (žádné
 *  duplicity), viz docs/adr/0012. */
async function reconcileInterruptedRuns(): Promise<void> {
  const runs = await tpvGetAll<MigrationRunRecord>("tpvMigrationRuns");
  for (const run of runs) {
    if (run.status === "running" || run.status === "pending") {
      await saveRun({
        ...run,
        status: "failed",
        finishedAt: Date.now(),
        error: "Běh byl přerušen (detekováno při startu dalšího migračního běhu) - nahrazen novým během.",
      });
    }
  }
}

export interface RunMigrationOptions {
  /** Jen pro testy - vynechá čtení skutečné IndexedDB "cnc-casovac" a použije
   *  dodaná data přímo. */
  legacyData?: LegacySourceData;
}

/**
 * Orchestruje všech deset fází (zadání, bod 12 a 29-Fáze 4). Entry point pro
 * dev nástroj (src/app/dev/tpv-migration) i pro testy.
 */
export async function runMigrationEngine(options: RunMigrationOptions = {}): Promise<MigrationReport> {
  await reconcileInterruptedRuns();

  const migrationRunId = newMigrationRunId();
  const startedAt = Date.now();
  const context = new MigrationContext(migrationRunId, TOOL_TYPE_FALLBACK_ID);

  let run: MigrationRunRecord = {
    id: migrationRunId,
    migrationVersion: MIGRATION_VERSION,
    status: "pending",
    startedAt,
    sourceDbVersion: SOURCE_DB_VERSION,
    targetDbVersion: TARGET_DB_VERSION,
    counters: emptyMigrationCounters(),
  };
  await saveRun(run);

  const customers = new IndexedDbCustomerRepository();
  const orders = new IndexedDbOrderRepository();
  const parts = new IndexedDbPartRepository();
  const machines = new IndexedDbMachineRepository();
  const machineCapabilities = new IndexedDbMachineCapabilityRepository();
  const operationTypes = new IndexedDbOperationTypeRepository();
  const tools = new IndexedDbToolRepository();
  const toolTypes = new IndexedDbToolTypeRepository();
  const toolMachineConditions = new IndexedDbToolMachineConditionRepository();
  const routingSheets = new IndexedDbRoutingSheetRepository();

  let persistedIssueCount = 0;
  const persistNewIssues = async (): Promise<void> => {
    for (let i = persistedIssueCount; i < context.issues.length; i++) {
      const issue = context.issues[i];
      await tpvPut("tpvMigrationIssues", {
        id: `${migrationRunId}:${i}`,
        migrationRunId,
        ...issue,
        createdAt: Date.now(),
      });
    }
    persistedIssueCount = context.issues.length;
  };

  try {
    run = { ...run, status: "running" };
    await saveRun(run);

    const data = options.legacyData ?? (await readLegacySourceData());

    // 1. Preflight
    runPreflightValidation(data, context);
    await persistNewIssues();
    if (context.hasFatal()) {
      run = {
        ...run,
        status: "failed",
        finishedAt: Date.now(),
        counters: context.counters,
        error: "Preflight validace našla fatální problém - migrace se nespustila. Viz tpvMigrationIssues.",
      };
      await saveRun(run);
      return buildReportFromCounters(migrationRunId, run.status, startedAt, run.finishedAt!, context.counters, context.issues, []);
    }

    // 2. Backup
    await runBackupPhase(migrationRunId, SOURCE_DB_VERSION);

    // 3. Seed číselníků
    await runSeedReferenceDataPhase(operationTypes, toolTypes, context);

    // 4. Migrace kmenových dat
    await runMigrateMasterDataPhase(data, { customers, orders, parts }, context);

    // 6. Migrace strojů a capability - záměrně PŘED fází 5 (technologická data),
    // přestože zadání čísluje fáze v opačném pořadí: Operation.machineId
    // potřebuje context.machineIdMap hotovou, jinak by každá operace se strojem
    // dopadla jako "stroj nebyl migrován" (viz test "chybějící Machine" -
    // závislost fází musí respektovat skutečná data, ne jen číslo v seznamu).
    await runMigrateMachinesPhase(data, { machines, capabilities: machineCapabilities }, context);

    // 5. Migrace technologických dat
    await runMigrateRoutingDataPhase(data, routingSheets, context);

    // 7. Migrace nástrojů a podmínek
    await runMigrateToolsPhase(data, { tools, conditions: toolMachineConditions }, context);

    // 8. Post-migration validation
    run = { ...run, status: "validating" };
    await saveRun(run);
    const validationChecks = await runPostValidationPhase(data, { customers, orders, parts, machines, routingSheets }, context);
    await persistNewIssues();

    const hasErrors = context.issues.some((i) => i.severity === "error" || i.severity === "fatal") || !validationChecks.every((c) => c.passed);
    const hasWarnings = context.issues.some((i) => i.severity === "warning");

    const finishedAt = Date.now();
    run = {
      ...run,
      status: hasErrors ? "failed" : hasWarnings ? "completed_with_warnings" : "completed",
      finishedAt,
      counters: context.counters,
    };
    await saveRun(run);

    if (run.status === "completed" || run.status === "completed_with_warnings") {
      await tpvPut("tpvSettings", { key: "migrationCompleted", value: true });
      await tpvPut("tpvSettings", { key: "newTpvModelEnabled", value: false });
      await tpvPut("tpvSettings", { key: "lastMigrationRunId", value: migrationRunId });
    }

    const report = buildReportFromCounters(migrationRunId, run.status, startedAt, finishedAt, context.counters, context.issues, validationChecks);

    if (process.env.NODE_ENV !== "production") {
      console.log("[TPV migrace] report:", report);
    }

    return report;
  } catch (error) {
    await persistNewIssues();
    const finishedAt = Date.now();
    run = {
      ...run,
      status: "failed",
      finishedAt,
      counters: context.counters,
      error: error instanceof Error ? error.message : String(error),
    };
    await saveRun(run);
    return buildReportFromCounters(migrationRunId, run.status, startedAt, finishedAt, context.counters, context.issues, []);
  }
}

export async function getMigrationRun(migrationRunId: string): Promise<MigrationRunRecord | undefined> {
  return tpvGet<MigrationRunRecord>("tpvMigrationRuns", migrationRunId);
}
