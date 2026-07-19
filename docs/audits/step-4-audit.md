# Audit před Krokem 4 – Editor technologického postupu

## Aktuální stav

### Struktura appky, routování
- Next.js 16.2.10 App Router (`src/app/`), React 19.2.4, TypeScript 5.9.3.
- `src/app/page.tsx` renderuje `CncApp` (`src/components/CncApp.tsx`) - **jedna klientská komponenta se svým vlastním interním `View` union stavem** (`home`/`customer`/`inquiry`/`part`/`nastroje`/`stroje`/`zalohy`), ne skutečné App Router sub-routy. Legacy appka routuje čistě přes `useState`, ne `next/navigation`.
- Jediná skutečná App Router route mimo `/` je `src/app/dev/tpv-migration/page.tsx` (Krok 3, `"use client"`, samostatná stránka bez napojení na `CncApp`) - to je přesně precedent, který Krok 4 bude následovat: nové TPV routy jsou samostatné App Router stránky, ne vsunuté do `CncApp`.
- **Rozhodnutí**: nové routy `/tpv/routing-sheets`, `/tpv/routing-sheets/new`, `/tpv/routing-sheets/[id]` (viz sekce "Návrh routování" níže) - vlastní `page.tsx` soubory, žádný zásah do `CncApp.tsx`/`page.tsx`.

### UI komponenty, design systém
- Žádná komponentní knihovna (žádné shadcn/ui, MUI, Radix, Chakra) - jen ručně psané komponenty s Tailwind utility třídami.
- `src/app/globals.css` definuje tmavý motiv přes CSS proměnné + `@theme inline` (Tailwind v4): `--color-background/surface/surface-raised/border/foreground/muted/accent/accent-dim/danger/ok`. Nový editor bude používat stejné tokeny (`bg-surface`, `text-muted`, `border-border`, `text-accent`, `text-danger` atd.), aby vizuálně zapadl.
- Tisk: existující vzor `.print-area` + `print:hidden` (viz `Summary.tsx`, `globals.css` `@media print` blok) - `window.print()` na tlačítko "Tisk / PDF", **žádná PDF knihovna** v `package.json`. Release výstup (bod 51) bude stejný vzor (`print-area` sekce), ne nový PDF engine.
- Žádné sdílené primitivum jako `Button`/`Dialog`/`Modal` - `AddKonturaModal.tsx` je jediný "modal" a je psaný ad-hoc (vlastní overlay div). Nový `ReleaseRoutingSheetDialog`/`CreateRevisionDialog` budou stejného ručního stylu, ne import z knihovny.

### Formulářová knihovna
- Žádná (žádný react-hook-form, formik). Formuláře jsou řízené komponenty (`useState` + `onChange`), viz `CncApp.tsx`/`PartWorkspace.tsx`. Editor DTO + custom hook nahradí potřebu formulářové knihovny.

### Stavový management
- Žádná knihovna (žádný Zustand, Redux, Jotai) v `package.json`. Legacy appka používá vlastní hooky nad IndexedDB (`src/lib/use*.ts` - `useCustomers`, `usePartRows`, `useAllTools`, `useUndoableRows`) - vzor "custom hook čte/zapisuje přímo do IndexedDB přes `src/lib/entities.ts`", žádná mezivrstva use casů (legacy appka je z doby před zavedením Clean Architecture v Kroku 2).
- **Zadání Kroku 4 (bod 14) říká "použij existující Zustand, pokud je standardem"** - Zustand v projektu NENÍ, takže se nezavádí jako nová závislost jen kvůli tomuto kroku. Editor state bude vlastní `useReducer`-based custom hook (`useRoutingSheetEditor`), konzistentní se stávajícím vzorem `src/lib/use*.ts`, ale narozdíl od legacy vzoru bude volat **application use casy**, ne přímo repository (zadání, bod 14: "Nedávej repository přímo do Zustand komponent").

### Drag-and-drop knihovna
- **Žádná** (`dnd-kit` není v `package.json`). Zadání (bod 10) říká "pokud projekt už dnd-kit používá, použij ho" - nepoužívá, takže se v tomhle kroku NEZAVÁDÍ jako nová závislost (vyhnutí se overengineeringu/rozsáhlé nové UI knihovně pro jeden krok). Řazení operací/upnutí/činností bude implementované přes tlačítka "Posunout nahoru/dolů" (zadání to explicitně vyžaduje jako alternativu i tak) - HTML5 nativní drag-and-drop nebo `dnd-kit` je zdokumentované jako budoucí vylepšení (`docs/step-4/known-limitations.md`), ne polovičatě implementované teď.

### Způsob načítání dat, DI
- Žádný DI kontejner (potvrzeno už v `docs/audits/step-3-5-audit.md`, stále platí). Use casy dostávají závislosti přes konstruktor, konkrétní repozitáře se instancují přímo (`new IndexedDbXxxRepository()`) na volajícím místě (dnes jen v testech a `migration-runner.ts`/`dev/tpv-migration`; UI zatím žádné use casy nevolá).
- Nový `useRoutingSheetEditor` hook bude v těle komponenty/hooku sestavovat use casy z konkrétních repozitářů stejným způsobem (žádný nový DI framework).

### Současný model technologického postupu (doména, Krok 2/3/3.5)
`RoutingSheet` (`src/domain/aggregates/routing-sheet/routing-sheet.ts`) je už Aggregate Root přesně podle zadání bodu 3 - `Operation → Position → Activity → Calculation`, transakční IndexedDB persistence (`IndexedDbRoutingSheetRepository`, normalizované records, **jedna IndexedDB transakce přes všech 5 stores** - transakční uložení požadované v bodu 44 už EXISTUJE, ne nutno stavět od nuly).

Rozdíly proti literálním typům ze zadání (zadání bod 3 výslovně říká "pokud doména používá jiné názvy, zachovej konzistenci" - podle toho postupuji):

| Zadání | Skutečná doména | Rozhodnutí |
|---|---|---|
| `RoutingSheetStatus = "draft"\|"released"\|"obsolete"` | `RoutingSheetStav = "draft"\|"released"\|"archived"` | Zachovat `"archived"` (existující), NE přejmenovávat na `"obsolete"` - stejný význam, jiné jméno. |
| `revision: number` | `verze: string` (dnes vždy číslo jako string, např. `"1"`) | Zachovat `verze: string` v doméně, editor DTO vystaví `revision: number` (parsováno). `getNextRevisionNumber` počítá `max(parseInt(verze)) + 1`. |
| `sourceRoutingSheetId` | `previousVersionId` | Zachovat `previousVersionId` (existující pole už přesně tohle dělá), editor DTO ho může vystavit jako `sourceRoutingSheetId`. |
| `name`/`description` | `nazev` (povinné), žádné `description` | Zachovat `nazev`. Přidat NOVÉ volitelné pole `popis?: string` (aditivní - dnes chybí úplně). |
| `createdBy`/`updatedBy`/`releasedBy` | neexistuje (appka nemá uživatele/auth) | Přidat jako volitelná pole (aditivně, připraveno na budoucí auth), dnes budou vždy `undefined` - appka nemá koncept přihlášeného uživatele. |
| `tenantId` na RoutingSheet | chybí (`docs/adr/0019` to vědomě odložilo) | **Přidat** `tenantId` na `RoutingSheet` (root) - Krok 4 explicitně vyžaduje tenant-scoped routing sheets (zadání body 32, 42, 60). Position/Activity/Calculation zůstávají BEZ tenantId (nedotčené FK-vnořené entity, izolace se hlídá na rootu). |
| `OperationResourceAssignment` (machine\|external\|unassigned) | `Operation.machineId?: string`, ŽÁDNÉ pole pro kooperaci | **Přidat** `Operation.externalResourceId?: string` (aditivní) + invariant "nikdy obě pole naráz" (nová validace v `Operation`/`RoutingSheet`). |
| `Operation.setupTimeMinutes`/`unitTimeMinutes`/`transferBatchSize` | neexistuje - čas je jen odvozený `Operation.finalTime` (součet `Activity.calculation.finalTime`) | **Přidat** jako nová volitelná pole na `Operation` - manuální/souhrnný čas na úrovni operace (obdoba `Calculation.manualCorrection`, ne náhrada odvozeného `finalTime`). Nutné hlavně pro operace bez rozpadu na Activity/Calculation (kooperace, ruční operace). |
| `OperationPosition` reordering | `Position.sortKey` je VOLITELNÉ a `RoutingSheet`/`Operation` nemá žádnou "movePosition" metodu (na rozdíl od `moveActivity`, které existuje) | **Přidat** `Operation.movePosition`/`RoutingSheet.movePosition` analogicky k existujícímu `moveActivity`. |
| `OperationActivity.name`/`description`/`timeMinutes` | `Activity` nemá `name` ani `timeMinutes` přímo - typ/název se odvozuje z `OperationType` přes `operationTypeId`, čas je `activity.calculation?.finalTime` | **Nepřidávat** duplicitní `name`/`timeMinutes` pole do domény - editor DTO odvodí zobrazovací `name` z `OperationType.nazev` (query) a `timeMinutes` z `activity.calculation?.finalTime`. Tohle je přesně případ "použij mapper nebo editor DTO" ze zadání bodu 5. |

### Současné obrazovky kalkulací, editor/formuláře
- `PartWorkspace.tsx` (legacy) je STARÝ editor nad STARÝM modelem (`src/lib/entities.ts::Position`/`PartOperationRows`, ne nová TPV doména) - běží nad `cnc-casovac` DB, ne `cnc-tpv`. **Nedotýkat se** (strangler pattern, žádná appka v Kroku 4 tenhle soubor needituje).
- `ResultsPanel.tsx` + `src/lib/results.ts::computeOperation` + `src/lib/calc.ts` = existující kalkulační engine nad `OPERATIONS`/`ColumnDef` konfigurací (`src/lib/operations.ts`) - datově řízený seznam typů operací, každý s vlastními sloupci (`kontura`, `Dc`, `Df`, `L`, `f`, `Vc`, `ap`, ...). **Tenhle výpočtový engine se v Kroku 4 znovu nepíše** - `LegacyCalculationEngine` (`src/infrastructure/calculation/legacy-calculation-engine.ts`) je už hotový adaptér implementující doménový port `CalculationEngine` (`domain/services/calculation-engine.ts`) nad `computeOperation`. Krok 4 tenhle adaptér jen POUŽIJE z nového `CalculateOperationUseCase`.
- `AddKonturaModal.tsx` je vzor pro "přidat řádek dynamické tabulky podle `ColumnDef[]`" - použitelný jako inspirace pro `CalculationPanel` vstupní řádky (kontury), ne 1:1 kopírovat (legacy modal pracuje se starým modelem).

### Existující PDF export, tiskové výstupy
Žádný PDF export. Tisk = `window.print()` + CSS `.print-area` (viz výše). Release výstup Kroku 4 použije stejný vzor.

### Licence z Kroku 3.5, FeatureAccessSnapshot, tenant-aware repository
- `FeatureCode` katalog (`src/domain/licensing/feature-code.ts`) UŽ obsahuje přesně to, co zadání bodu 30 vyžaduje: `routing.view`, `routing.edit`, `routing.release`, `calculations.basic`, `calculations.advanced`, `machines.view`, `tools.view`, `cooperations.view` - **nic nového netřeba přidávat do katalogu**.
- `FeatureAccessService`/`DefaultFeatureAccessService`, `FeatureGate` (`src/presentation/components/feature-gate.tsx`) - hotové a otestované, přímo použitelné.
- **Riziko**: výchozí lokální licence (`ensureDefaultTenantAndLicense`, `src/infrastructure/licensing/seed-default-tenant.ts`) dnes NEobsahuje `routing.release` ani `cooperations.view` - kdyby zůstalo beze změny, čerstvá instalace appky by nikdy nemohla vydat postup ani vybrat kooperaci, což je v přímém rozporu s cílem Kroku 4 ("vytvořit POUŽITELNÝ editor"). **Rozhodnutí**: rozšířit výchozí licenci o `routing.release: full` a `cooperations.view: full` (malá, zdůvodněná změna - ne nový mechanismus, jen doplnění datové sady, která už existuje).
- `TenantContext`/`LocalTenantContext`, `DEFAULT_TENANT_ID` - hotové, editor je použije stejně jako use casy z Kroku 3.5.
- Tenant-aware repository vzor (`findById(id, tenantId)`, `[tenantId, code]` unikátnost) existuje pro `Machine`/`CapacityGroup`/`ExternalOperationResource`/`ExternalSystem`. **`ToolRepository`/`OperationTypeRepository` NEJSOU tenant-scoped** (zůstaly `Repository<T>` i po přidání `tenantId` pole na `Tool` v Kroku 3.5 - mezera zděděná z minula). Krok 4 tohle nebude opravovat (číselníky nejsou v centru tohoto kroku), ale zdokumentuje jako známé omezení.

### DB schéma po Kroku 3.5
`cnc-tpv`, `DB_VERSION = 3` (`src/infrastructure/persistence/indexeddb/tpv-db.ts`). Relevantní stores pro Krok 4: `tpvRoutingSheets`, `tpvOperations`, `tpvPositions`, `tpvActivities`, `tpvCalculations` (žádný z nich nemá `tenantId` index). Krok 4 povýší na `DB_VERSION = 4` (aditivně): přidá `tenantId` index na `tpvRoutingSheets`, nový store `tpvReleasedRoutingSheetSnapshots` (immutable release projekce, bod 52).

### Existující use cases
Z Kroku 3.5: `CreateMachineUseCase`, `UpdateMachineUseCase`, `DeactivateMachineUseCase`, `ResolveMachineByCodeUseCase`, `AssignMachineToCapacityGroupUseCase`, `CreateCapacityGroupUseCase`, `CreateExternalOperationResourceUseCase`, `GetCurrentTenantUseCase`, `GetFeatureAccessSnapshotUseCase`. **Žádný use case pro RoutingSheet/Operation/Position/Activity/Calculation zatím neexistuje** - repository i doména jsou hotové, ale nic mezi UI a doménou dnes nestojí. To je přesně to, co Krok 4 doplňuje.

### Migrační omezení
Migrace (Krok 3) migruje legacy `positions`/`partOperationRows` do `RoutingSheet` bez `tenantId` (protože pole tehdy neexistovalo). Po přidání `tenantId` na `RoutingSheet` musí `migrate-routing-data.ts` dostat `tenantId: DEFAULT_TENANT_ID` stejně, jako to `migrate-machines.ts` dostalo v Kroku 3.5 - **jinak by staré/nově migrované postupy nešly načíst tenant-scoped repository metodou**. Zjištěno jako riziko zpětné kompatibility, řeší se v rámci Fáze 4.

### Způsob zpracování chyb
Doménové chyby (`src/domain/errors/`) - `ValidationError`, `NotFoundError`, `ConflictError`, `InvalidStateError`, licenční chyby (`FeatureNotLicensedError`, `ReadOnlyLicenseError`, `LicenseExpiredError`, `TenantNotActiveError`, ...). UI zatím NEMÁ žádné mapování těchto chyb na uživatelské zprávy (žádná appka dosud nevolala use casy z UI) - Krok 4 musí tohle mapování postavit od nuly (zadání bod 49).

### Testovací framework
`vitest` + `fake-indexeddb/auto` (`vitest.setup.ts`), `src/**/*.test.ts`. Žádný React component testing (žádný `@testing-library/react`/`jsdom` - zdokumentováno už v `docs/step-3-5/known-limitations.md`, stále platí). UI testy v Kroku 4 budou testovat **extrahovanou čistou logiku** (editor reducer, mappery, validace), ne skutečné vykreslení komponent do DOM - stejný vzor jako `FeatureGate`/`resolveFeatureGateState` z Kroku 3.5.

## Použitelné části (znovupoužít beze změny)
- `RoutingSheet` aggregate + `IndexedDbRoutingSheetRepository` (transakční save/load) - jádro zůstává, jen se rozšíří.
- `LegacyCalculationEngine`/`CalculationEngine` port - použije se přímo.
- `FeatureAccessService`/`FeatureGate`/`TenantContext`/`DEFAULT_TENANT_ID` - použije se přímo.
- `Machine`/`MachineRepository`/`CapacityGroup`/`ExternalOperationResource` (výběr zdroje) - použije se přímo.
- `SortKey` (fractional indexing) pro řazení - použije se přímo pro upnutí i další řazení.
- Design tokeny z `globals.css`, vzor `.print-area`.

## Části vhodné k refaktoringu/rozšíření (v rámci tohoto kroku)
- `RoutingSheetRepository` - rozšířit o `findDraftByPartId`, `listByPartId` (case-insensitive rename `findByPartId`→ponechat, přidat tenant param), `getNextRevisionNumber`, tenant-scoped `findById(id, tenantId)`.
- `RoutingSheet`/`Operation` doména - aditivní pole podle tabulky výše (`tenantId`, `popis`, `createdBy`/`updatedBy`/`releasedBy`, `externalResourceId`, `setupTimeMinutes`/`unitTimeMinutes`/`transferBatchSize`, `movePosition`).
- `ensureDefaultTenantAndLicense` - přidat `routing.release`, `cooperations.view` do výchozí licence.
- `tpv-db.ts` - `DB_VERSION` 3→4.

## Rizika
1. **Přidání `tenantId` na `RoutingSheetRecord`/doménu je breaking pro starý (Krok 3) migrovaný obsah**, pokud `tenantId` bude povinné pole - řeší migrace (viz "Migrační omezení" výše), stejný vzor jako Krok 3.5 u `Machine`.
2. **`Operation.setupTimeMinutes`/`unitTimeMinutes` vs. odvozené `Operation.finalTime`** - riziko matoucího UI, pokud obě hodnoty existují a nesedí. Zmírněno jasnou dokumentací (manuální pole = souhrnný/zadaný čas, `finalTime` = dopočet z Activity) a UI popiskem, ne automatickým slučováním.
3. **Bez `dnd-kit`/Zustand jde o víc ručně psaného kódu** - akceptované riziko, zdokumentované jako vědomé rozhodnutí (žádná nová závislost jen kvůli jednomu kroku).
4. **`Tool`/`OperationType` repository nejsou tenant-scoped** - editor je použije tak, jak jsou (globální číselníky), zdokumentováno jako známé omezení, ne řešeno teď.
5. **Rozsah zadání (70 bodů) je mnohem větší než realisticky pokryjitelné 1:1** (60+ jednotlivých testů, 14 dokumentů, 7 ADR, kompletní UI). Budu implementovat funkční jádro (doména, use casy, persistence, editor state, klíčové UI komponenty, licence, revize, release, validace) a reprezentativní (ne vyčerpávající) sadu testů - explicitně přiznáno v závěrečném reportu, ne tiše zamlčeno.

## Dotčené soubory (očekávaný rozsah)
`src/domain/aggregates/routing-sheet/*` (routing-sheet.ts, operation.ts, position.ts), `src/domain/repositories/routing-sheet-repository.ts`, `src/infrastructure/persistence/indexeddb/records/routing-sheet-records.ts`, `mappers/routing-sheet-mapper.ts`, `repositories/indexeddb-routing-sheet-repository.ts`, `tpv-db.ts`, `src/infrastructure/licensing/seed-default-tenant.ts`, nové `src/application/routing-sheets/*`, nové `src/presentation/routing-sheets/*` (editor state + komponenty), nové `src/app/tpv/routing-sheets/**`.

## Návrh implementace
Viz task list Fáze 2-12 (tento dokument je Fáze 1). Postup: doména → application use casy → persistence rozšíření → editor state (hook) → UI kostra → upnutí/činnosti → kalkulace → validace/release → testy → dokumentace/ADR → verifikace.

## Rizika zpětné kompatibility
- Beze změny zůstávají: legacy appka (`src/app/page.tsx`, `src/components/*`, `src/lib/*`, `cnc-casovac` DB) - nedotčeno.
- Beze změny zůstávají: všechny Krok 2/3/3.5 testy (86+137+21 = dosavadních 158 testů) - musí dál procházet po aditivních změnách domény.
- `RoutingSheetRecord`/doména dostávají nová pole - všechna aditivní/volitelná KROMĚ `tenantId`, které bude povinné na doméně (`RoutingSheetProps.tenantId: string`), ale migrace ho doplní, takže žádná ztráta dat nehrozí (stejný vzor jako `Machine.tenantId` v Kroku 3.5).
