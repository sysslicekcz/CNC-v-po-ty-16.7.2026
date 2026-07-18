# Audit před Krokem 3.5

## Aktuální stav

- **Next.js 16.2.10, React 19.2.4, TypeScript 5.9.3** (ověřeno v `node_modules`). App Router (`src/app/`), žádný Pages Router.
- **Žádná Dexie** ani jiná IndexedDB knihovna - vlastní tenký promisifikovaný wrapper nad nativním IndexedDB API, dvě nezávislé databáze:
  - `cnc-casovac` (`src/lib/db.ts`, `DB_VERSION = 4`) - stará appka, nedotčená.
  - `cnc-tpv` (`src/infrastructure/persistence/indexeddb/tpv-db.ts`, `DB_VERSION = 1`) - nová TPV doména z Kroku 3, stores: `tpvCustomers, tpvOrders, tpvParts, tpvRoutingSheets, tpvOperations, tpvPositions, tpvActivities, tpvCalculations, tpvMachines, tpvMachineCapabilities, tpvOperationTypes, tpvTools, tpvToolTypes, tpvToolMachineConditions, tpvMigrationRuns, tpvMigrationIssues, tpvMigrationBackups, tpvSettings`.
- **Dependency injection**: žádný DI kontejner. Use casy (zatím žádné formálně neexistují mimo `runMigrationEngine`) přijímají závislosti přes konstruktor/parametry, konkrétní repozitáře se instancují přímo (`new IndexedDbXxxRepository()`).
- **Doménové entity** (`src/domain/entities/`, `src/domain/aggregates/routing-sheet/`): `Customer`, `ContactPerson` (vnořená), `Order`, `Part`, `RoutingSheet` (Aggregate Root) → `Operation` → `Position` → `Activity` → `Calculation`, `Machine`, `MachineCapability`, `OperationType`, `Tool`, `ToolType`, `ToolMachineCondition`. Konvence: entity používají **české** názvy polí (`nazev`, `stav`, `oznaceni`, `poznamka`, `maxOtacky`), Value Objects a technické typy anglické.
- **`Machine` (aktuální podoba, `src/domain/entities/machine.ts`)**: `{id, nazev, oznaceni?, maxOtacky?, hourlyRate: HourlyRate, stav: EntityStav, poznamka?}`. **Žádné `tenantId`, žádný `code`, žádný `capacityGroupId`.** Repository (`src/domain/repositories/machine-repository.ts`) je jen `Repository<Machine>` (CRUD), žádný `findByCode`/`count`/tenant scope.
- **`Operation` (aktuální podoba)**: `{id, operationNumber, sortKey, nazev, stav, machineId?, technologickaPoznamka?}` + vnořené `Position[]`. `machineId?: string` už odkazuje na `Machine.id` - přesně vazba požadovaná v bodu 3 zadání, beze změny potřeba.
- **`CalculationSnapshot` (aktuální podoba, `src/domain/aggregates/routing-sheet/types.ts`)**: `{machineId?, machineName?, machineHourlyRate?, toolId?, toolName?, toolTypeId?, operationTypeId, operationTypeCode, cuttingParameters?, calculatedAt, applicationVersion?, calculationEngineVersion, gitCommit?}`. **Chybí `machineCode`/`toolCode`.**
- **`ExternalLink`/obdobná struktura**: neexistuje. V dřívější iteraci (Krok 1) byla navržena `ExternalReference`, ale v Kroku 2 byla záměrně odstraněna jako nepoužitá abstrakce. Legacy metadata (`legacyId`, `legacySource`, `migrationRunId`) existují jen v perzistenční vrstvě (`LegacyMetadata` mixin), ne v doméně.
- **Organizace/firma/tenant**: neexistuje vůbec. Appka je čistě lokální/jednouživatelská.
- **Feature flag systém**: neexistuje. Jediný existující "flag" je `meta.legacyMigrated` ve staré DB (nesouvisející jednorázový import z `localStorage`) a `tpvSettings.migrationCompleted`/`newTpvModelEnabled` z Kroku 3 (taky nesouvisí s licencemi).
- **Kontrola funkcí v UI**: žádná - staré UI (`CncApp.tsx` atd.) nemá žádné podmínky podle licence/tarifu, protože žádný licenční koncept neexistuje.
- **Server/cloud komunikace**: appka je čistě offline, žádný `fetch`/API klient nikde v `src/`.
- **Migrace (Krok 3)**: `src/infrastructure/migration/` - 10 fází, deterministická id, idempotentní přes `put()`. `migrate-machines.ts` migruje `machines` → `Machine` 1:1 bez tenanta a bez kódu (protože ani jedno v Kroku 3 neexistovalo).

## Nalezená rizika

1. **`Machine` se v Kroku 3.5 mění na anglické názvy polí** (`code`, `name`, `designation`, `maxRpm`, `status`, `note`) podle explicitního zadání - to je rozchod se stávající českou konvencí zbytku domény. Řeším jako **záměrnou, zdokumentovanou výjimku jen pro `Machine`** (a nově `Tenant`/`License`/`CapacityGroup`/`ExternalOperationResource`, které zadání taky specifikuje anglicky) - zbytek domény (Customer, Order, Part, Operation, Activity...) zůstává český, neriskuji plošný přejmenovávací refaktor mimo rozsah kroku.
2. **Přejmenování `Machine` je breaking change** dotýkající se: `machine-mapper.ts`, `indexeddb-machine-repository.ts`, `migrate-machines.ts`, `machine-tool-repositories.test.ts`. Všechny čtyři soubory aktualizuji a znovu otestuji v rámci tohoto kroku (žádné jiné soubory na tvar `Machine` nesahají - `src/lib/*`/`src/components/*` mají svůj vlastní, nesouvisející legacy typ `Machine` ze staré appky).
3. **IndexedDB verze `cnc-tpv` musí povýšit z 1 na 2** kvůli novým stores a novému indexu `[tenantId+code]` na `tpvMachines`. Řeším přísně aditivně (`onupgradeneeded` jen přidává, nic nemaže/nepřepisuje) - stejný bezpečný vzor jako dosavadní verze.
4. **Existující migrovaná data (z běhů Kroku 3) nemají `tenantId`/`code`.** Migrace strojů se rozšíří o dosazení `tenant:local-default` a deterministický fallback kód `LEGACY-MACHINE-{legacyId}`, pokud stroj nemá jinde spolehlivý kód (legacy `machines` store žádný kód neměl - vždy fallback, s warningem v reportu).
5. **`Tool.code` je nepovinné** podle zadání (bod 18) - legacy `toolRows` nemají žádný stabilní kód, takže migrace ho u migrovaných nástrojů nevyplní (zůstane `undefined`), nevymýšlím fiktivní kód.

## Navržené změny (shrnutí, detail v ADR a `docs/step-3-5/`)

- Nové VO: `MachineCode`, `TenantCode`, `CapacityGroupCode`, `ExternalResourceCode`, `ToolCode`.
- Nové entity: `Tenant`, `CapacityGroup`, `ExternalOperationResource`, `License` (+ `LicensedFeature`, `LicenseLimit`, `LicenseValidationState`).
- Rozšíření `Machine` (anglické názvy, `tenantId`, `code`, `capacityGroupId`), rozšíření `Tool` (`tenantId`, volitelný `code`), rozšíření `CalculationSnapshot` (`machineCode`, `toolCode`).
- `TenantContext` (`LocalTenantContext`), `LicenseProvider`/`LicenseRepository` (`LocalLicenseProvider`, `DevelopmentLicenseProvider`, `IndexedDbLicenseRepository`), `FeatureAccessService`.
- Nové IndexedDB stores: `tpvTenants`, `tpvLicenses`, `tpvLicenseValidation`, `tpvCapacityGroups`, `tpvExternalOperationResources` (`cnc-tpv` DB_VERSION 1 → 2).
- Migrace: seed výchozího tenanta a licence, rozšíření `migrate-machines.ts` o `tenantId`+`code`.
- Application use casy (sekce 36 zadání), `FeatureGate` UI komponenta.

## Dotčené soubory (Machine rename + tenant-aware rozšíření)

`src/domain/entities/machine.ts`, `src/domain/repositories/machine-repository.ts`, `src/infrastructure/persistence/indexeddb/records/machine-tool-records.ts`, `src/infrastructure/persistence/indexeddb/mappers/machine-mapper.ts`, `src/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository.ts`, `src/infrastructure/persistence/indexeddb/repositories/machine-tool-repositories.test.ts`, `src/infrastructure/migration/phases/migrate-machines.ts`, `src/infrastructure/persistence/indexeddb/tpv-db.ts`, `src/domain/aggregates/routing-sheet/types.ts` (CalculationSnapshot).

## Možné problémy se zpětnou kompatibilitou

- Žádné - stará appka (`cnc-casovac`) se nedotýká, `cnc-tpv` upgrade je čistě aditivní (nový store/index neruší staré záznamy, jen jim commit chybí nová pole, což mappery řeší jako `undefined`/chybu podle pole - **`Machine.code`/`Machine.tenantId` jsou ale nově POVINNÁ pole domény**, takže staré `MachineRecord` záznamy z běhů před tímto krokem by bez znovuspuštění migrace nešly načíst mapperem (chybějící povinná pole). To je přijatelné, protože jde o interní vývojové prostředí bez produkčních dat - zdokumentováno jako známé omezení, ne tiše ignorováno.
