# Migrace TPV v1 → v2

Jednorázová (opakovatelná) migrace dat ze staré kalkulačky (IndexedDB `cnc-casovac`) do nového TPV doménového modelu (IndexedDB `cnc-tpv`). Kód: `src/infrastructure/migration/`.

## Zdrojový model (`cnc-casovac`, `src/lib/db.ts`, `DB_VERSION = 4`)

```
customers { id, nazev, createdAt }
inquiries { id, customerId, nazev, createdAt }
parts { id, inquiryId, cisloVykresu, nazev, createdAt }
positions { id, partId, nazev, createdAt, strojId? }
partOperationRows { id, partId, opId, rows: Row[] }   -- partId je ve skutečnosti id POLOHY
machines { id, nazev, sazba, operace: string[], createdAt }
toolRows { id, strojId, opId, rows: Row[] }           -- rows = víc pojmenovaných řádků, ne 1 nástroj
```

**Důležité:** `partOperationRows.partId` nese id polohy (`Position.id`), ne id dílu - viz `src/components/PartWorkspace.tsx:72-74` a `src/lib/entities.ts::ensureDefaultPosition`. `toolRows` je jeden záznam na dvojici (stroj, typ operace) s polem řádků uvnitř; jednotlivé řádky nemají vlastní id.

## Cílový model (`cnc-tpv`, `src/infrastructure/persistence/indexeddb/tpv-db.ts`)

```
Customer → Order → Part → RoutingSheet → Operation → Position → Activity → Calculation
Machine → MachineCapability
Tool → ToolMachineCondition
OperationType, ToolType (číselníky)
```

## Mapování entit

| Legacy | Nové | Pravidlo |
|---|---|---|
| `customers` | `Customer` | 1:1, deterministické id `tpv-customer:{legacyId}` |
| `inquiries` | `Order` | 1:1. Číslo zakázky chybí → placeholder `LEGACY-{legacyInquiryId}`. Stav → `"nova"` + poznámka (legacy nemá status pole) |
| `parts` | `Part` | 1:1. Množství chybí v legacy datech → výchozí 1 ks + poznámka |
| `parts` | `RoutingSheet` | 1 výchozí na díl (`isDefault=true`, `stav="draft"`, `verze="1"`) |
| `positions` | `Operation` **+** `Position` | **1:1, žádné seskupování** (viz ADR 0013). `Operation.machineId = Position.strojId` |
| `partOperationRows` | `Activity` | 1:1 na řádek. `calculationType = opId`. `operationTypeId` přes seed. **Bez Calculation** (viz níže) |
| `machines` | `Machine` | 1:1. Měna chybí → výchozí `CZK` |
| `machines.operace[]` | `MachineCapability` | 1 na položku pole, `opId` → `operationTypeId` přes seed |
| `toolRows[].rows[]` | `Tool` **+** `ToolMachineCondition` | 1 na řádek (ne 1 na `toolRows` záznam!). Identita `${strojId}:${opId}:${index}` - žádná deduplikace mezi stroji. `pripravneCasy` řádky se vynechávají (nejsou nástroje) |

## Proč 1 Position → 1 Operation + 1 Position (ne seskupení podle `opId`)

Viz ADR 0013. Seskupování by ničilo originální vazbu stroj↔upnutí↔výpočty a vyžadovalo hádání konfliktů, když stejný `opId` běžel na různých strojích. Bezpečnější je zachovat hranice přesně tak, jak existovaly, i za cenu, že vznikne poměr Operation:Position 1:1 (nová možnost "víc upnutí na operaci" prostě legacy data nevyužívala).

## Proč Calculation chybí

Stará appka nikdy neukládala vypočtený výsledek - `ResultsPanel` ho vždy počítá za běhu voláním `computeOperation`. Migrace proto **nepřepočítává nic automaticky** (bylo by to fabrikování výsledku). Vstupní řádky (`rows`) se zachovají v `ActivityRecord.legacyInputParameters` (persistence-only pole, doména `Activity` ho nezná) jako podklad pro budoucí explicitní přepočet.

## Idempotence

Viz ADR 0012 - deterministická id + `put()` upsert. Druhé spuštění nad stejnými daty nevytvoří duplicity. Přerušený běh (`status="running"` po pádu) se při dalším startu označí jako `"failed"` a spustí se nový - bezpečné díky idempotenci.

## Rollback

`rollbackMigrationRun(migrationRunId)` smaže jen záznamy s daným `migrationRunId` napříč novými stores (vč. celého stromu `RoutingSheet` přes `IndexedDbRoutingSheetRepository.delete()`). Seed číselníky (`OperationType`, `ToolType`) se nemažou - jsou sdílené a nemají legacy metadata. Staré stores (`cnc-casovac`) rollback nikdy nemaže.

## Známé konflikty a jejich řešení

| Situace | Řešení |
|---|---|
| Neznámý `opId` (v `partOperationRows` i `machines.operace`) | `warning` v reportu, fallback `OperationType` v kategorii `other` (`unknown-legacy`) - nic se nezahazuje |
| `Position.strojId` odkazuje na neexistující stroj | `Operation.machineId` zůstane prázdné, `warning`, Activity data se migrují normálně |
| `Inquiry`/`Part` odkazuje na neexistujícího rodiče | Záznam se přeskočí (`error`, ne `fatal`) - nejde vytvořit validní doménový objekt bez rodiče, zbytek migrace pokračuje |
| Duplicitní id v rámci jednoho legacy store | `fatal` - zastaví migraci před jakýmkoli zápisem (deterministická id by kolidovala) |

## Jak migraci spustit

Dev stránka `/dev/tpv-migration` (`src/app/dev/tpv-migration/page.tsx`) - tlačítko "Spustit migraci", zobrazí a umožní stáhnout JSON report, tlačítko pro rollback. Programově: `runMigrationEngine()` z `src/infrastructure/migration/migration-runner.ts`.

## Jak ověřit report

`MigrationReport` obsahuje `sourceCounts`/`targetCounts`/`created`/`skipped`/`updated`, `warnings`/`errors` (pole `MigrationIssue`) a `validation.checks` (pole `ValidationCheckResult` - referenční integrita, výchozí postup 1:1 na díl, shoda vstupních dat výpočtu přes hluboké porovnání, počty a sazby strojů). `validation.passed === false` znamená, že post-migration validace našla nesrovnalost - zkontrolovat `errors` před tím, než se s daty dál pracuje. Report je zároveň vypsaný do konzole (`console.log`) v development režimu a uložený v `tpvMigrationRuns`/`tpvMigrationIssues`.
