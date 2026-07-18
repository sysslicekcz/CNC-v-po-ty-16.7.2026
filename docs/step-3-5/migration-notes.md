# Migrace – změny v Kroku 3.5

Navazuje na `docs/migrations/tpv-v1-to-v2.md` (Krok 3). Tenhle dokument popisuje jen to, co Krok 3.5 na migračním enginu změnilo.

## IndexedDB schema `cnc-tpv`: v1 → v2

`src/infrastructure/persistence/indexeddb/tpv-db.ts` - `DB_VERSION` povýšeno z `1` na `2`. Upgrade je striktně aditivní (`if (oldVersion < 2) { ... }`, stejný bezpečný vzor jako existující `if (oldVersion < 1)` blok a jako `src/lib/db.ts` u staré appky):

- Nové indexy na JIŽ existujících stores (`tpvMachines`, `tpvMachineCapabilities`, `tpvTools`, `tpvToolMachineConditions`, `tpvMigrationRuns`, `tpvMigrationIssues`) - přidané přes `upgradeTx.objectStore(name)` (probíhající versionchange transakce z `IDBOpenDBRequest.transaction`), NE přes nový `db.transaction()` (to při `onupgradeneeded` není možné).
- Nové stores: `tpvTenants`, `tpvCapacityGroups`, `tpvExternalOperationResources`, `tpvLicenses`, `tpvLicenseValidation`.

Nic se neničí ani nepřepisuje - appky s daty z Kroku 3 (DB_VERSION 1) při prvním otevření po upgradu dostanou nové indexy/stores, staré záznamy zůstávají netknuté.

## Seed tenanta a licence na začátku běhu

`runMigrationEngine()` (`src/infrastructure/migration/migration-runner.ts`) teď na úplném začátku volá `ensureDefaultTenantAndLicense()` - PŘED `reconcileInterruptedRuns()` a před jakoukoliv fází. Migrovaná data patří `DEFAULT_TENANT_ID`, tenant a jeho licence musí existovat dřív, než na ně cokoliv začne odkazovat. Idempotentní, bezpečné volat opakovaně.

`MigrationRunRecord`/`MigrationIssueRecord` teď obě nesou `tenantId: DEFAULT_TENANT_ID`.

## `migrate-machines.ts` – tenantId a fallback kód

Legacy `machines` store nikdy neměl kód. Protože `Machine.code`/`Machine.tenantId` jsou nově POVINNÁ pole domény, `runMigrateMachinesPhase`:

1. Přidělí `tenantId: DEFAULT_TENANT_ID` každému migrovanému stroji.
2. Přidělí deterministický fallback kód `LEGACY-MACHINE-{legacyId}` (`MachineCode.create(...)`).
3. Zaloguje `warning` issue `"machine-code-fallback-assigned"` s doporučením doplnit skutečný Helios kód - **u každého migrovaného stroje**, protože legacy data žádný kód nikdy neobsahovala.
4. Pole se přejmenovalo `nazev` → `name`, `stav: "aktivni"` → `status: "active"` (anglické názvy, viz `docs/adr/0015`).

Stejná změna se promítla do `MachineCapability.create(...)` (přidán `tenantId`) a do `migrate-tools.ts` (`Tool.create`/`ToolMachineCondition.create` - přidán `tenantId`, beze změny českých názvů polí, protože `Tool`/`ToolMachineCondition` si českou konvenci zachovávají).

## `post-validation.ts`

Kontrola `machines-count-and-hourly-rate-match` teď volá `machines.findById(newId, DEFAULT_TENANT_ID)` - nová tenant-scoped signatura `MachineRepository.findById`.

## Regresní ověření

Po všech změnách proběhl plný `npx vitest run` (viz finální report v `docs/step-3-5/` / commit message) - stávající migrační scénáře (preflight, backup, seed, master-data, routing-data, machines, tools, post-validation, report, idempotency, rollback) prošly beze změny očekávaného chování, jen s novým `warning` issue za fallback kód stroje (testy už tolerovaly `["completed", "completed_with_warnings"]`, takže nevyžadovaly úpravu).
