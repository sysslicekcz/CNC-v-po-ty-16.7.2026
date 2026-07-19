# Krok 5 – audit: správa kmenových dat TPV

Audit předchází implementaci (zadání, bod 1). Cituje přesné soubory a řádky současného stavu, ne jen obecný popis. Navazuje na `docs/audits/step-3-5-audit.md` a `docs/audits/step-4-audit.md` - opakuje jen to, co je pro Krok 5 nové nebo se od nich liší.

## 1. Co už existuje (nestavět paralelně)

| Entita | Soubor | Stav |
|---|---|---|
| `Machine` | `src/domain/entities/machine.ts` | Hotovo z Kroku 3.5 - `id`, `tenantId`, `code: MachineCode`, `name`, `designation?`, `maxRpm?`, `hourlyRate: HourlyRate`, `status: "active"\|"inactive"`, `note?`, `capacityGroupId?`. Chybí `category`/`manufacturer`/`model`/`maxPowerKw` ze zadání (bod 5) - viz Fáze 5. |
| `CapacityGroup` | `.../capacity-group.ts` | Hotovo z Kroku 3.5 - přesně odpovídá zadání (bod 8). |
| `MachineCapability` | `.../machine-capability.ts` | **POZOR - jiný význam, než zadání předpokládá (bod 10).** Existující `MachineCapability` = "stroj M umí typ operace O" (`machineId`, `operationTypeId`, `enabled`, `priority`, `limitations: {schemaVersion, values}`). Zadání chce capability jako TECHNICKOU vlastnost stroje (max. průměr, počet os, poháněné nástroje) přes `capabilityTypeId`. Řešení: existující třída se NEPŘEJMENOVÁVÁ ani nemaže (používá ji `machine-type-classifier.ts` a bude ji používat editor pro filtrování strojů podle typu operace) - nová typová capabilita dostane VLASTNÍ jméno `MachineCapabilityValue`, aby nekolidovala. Viz Fáze 5. |
| `OperationType` | `.../operation-type.ts` | Existuje, ale **NENÍ tenant-scoped** (`id`, `kod`, `nazev`, `kategorie`, `stav: EntityStav`, `popis?`) - žádné `tenantId` pole, store `tpvOperationTypes` nemá žádný index kromě `keyPath`. Seedováno JEDNOU deterministicky z `src/lib/operations.ts` (`operation-type-seed.ts`), nikdy netvořeno uživatelem. Krok 5 z něj dělá editovatelná kmenová data (formulář v UI) - tenant scope proto MUSÍ přibýt, jinak by jeden tenant viděl vlastní typy operací založené jiným tenantem. Viz riziko migrace níže. |
| `ExternalOperationResource` | `.../external-operation-resource.ts` | Hotovo z Kroku 3.5 - `id`, `tenantId`, `code`, `name`, `supplierId?`, `status`, `note?`. Chybí `supportedOperationTypeIds?`/`defaultLeadTimeDays?`/`defaultCost?: Money` ze zadání (bod 15) - doplnit. |
| `Tool` | `.../tool.ts` | Existuje s `tenantId`, ale **repository není tenant-scoped** (`ToolRepository = Repository<Tool>`, žádný `tenantId` parametr) - `findById`/`findAll` nefiltrují podle tenanta, přestože pole existuje. Latentní mezera v izolaci (nikdy prakticky neprojevená, protože appka dosud běžela jen s jedním tenantem, ale objektivně chyba). Chybí `manufacturer?`/`designation?`/dynamické `parameters` ze zadání (bod 17-19) - `designation` už NENÍ na `Tool`, `radius`/`defaultCuttingParameters` jsou pevná pole, ne generický `ToolParameters` bag. |
| `ToolType` | `.../tool-type.ts` | Stejný problém jako `OperationType` - žádné `tenantId`, žádné `parameterDefinitions` (zadání bod 18-19), jen `kod`/`nazev`/`stav`/`popis`. |
| `ToolMachineCondition` | `.../tool-machine-condition.ts` | Existuje s `tenantId`, ale repository (`ToolMachineConditionRepository extends Repository<T>`) opět NENÍ tenant-scoped. Model je bohatší než zadání (`machiningMode`, `priority`, `materialId?` už PŘIPRAVENÉ pro budoucí `Material` entitu, které dosud neexistuje) - **zachovat beze změny tvaru**, jen doplnit tenant scope a napojit `materialId` na novou entitu. |
| `services/cutting-condition-resolver.ts` | `resolveCuttingConditions(tool, profiles, operationTypeId)` | Už implementuje přesně zadání bod 21 (priorita profil→tool default), jen jako čistou funkci, ne třídu `CuttingConditionResolver`. **Zachovat, jen rozšířit** o `materialGroupId` filtr, ne přepisovat. |
| `machine-type-classifier.ts` | `classifyMachineType(categories)` | Odvozuje typ stroje z `MachineCapability` (existující, ne nová) - beze změny. |

### Application use cases – co existuje

| Adresář | Obsah |
|---|---|
| `application/machines/` | `create-machine-use-case.ts`, `update-machine-use-case.ts`, `deactivate-machine-use-case.ts`, `resolve-machine-by-code-use-case.ts`, `assign-machine-to-capacity-group-use-case.ts`. Chybí `ReactivateMachineUseCase`, `ListMachinesUseCase` jako samostatná třída (dnes se listuje přímo přes repository), `GetMachineUseCase`. |
| `application/capacity-groups/` | Jen `create-capacity-group-use-case.ts`. Chybí update/deactivate. |
| `application/cooperations/` | Jen `create-external-operation-resource-use-case.ts`. Chybí update/deactivate. |
| Tool/ToolType/OperationType/ToolMachineCondition/MachineCapability | **ŽÁDNÉ application use casy neexistují** - jen doménové entity + `Repository<T>`. Celá aplikační vrstva pro tyhle číselníky je práce Kroku 5. |

### UI – co existuje

**Nic pro TPV kmenová data.** `src/presentation/` obsahuje jen `routing-sheets/` (Krok 4) a `components/` (`feature-gate.tsx`, `feature-unavailable-notice.tsx`). `src/app/` obsahuje jen `/dev/tpv-migration` a `/tpv/routing-sheets/*`. Legacy appka MÁ vlastní obrazovky "Stroje"/"Nástroje" (`CncApp.tsx` interní `View` union), ale ty čtou/zapisují STAROU databázi `cnc-casovac`, ne TPV doménu - jsou zcela nezávislé a Krok 5 se jich nedotýká (strangler pattern, stejně jako Krok 4 nechalo legacy dílenský formulář netknutý).

## 2. Duplicity a nejasné významy polí

1. **Tři anglické stavové aliasy jsou identické, ale pojmenované zvlášť:** `MachineStatus`, `CapacityGroupStatus`, `ExternalResourceStatus` (všechny `"active" | "inactive"`, definované v `machine.ts`, `capacity-group.ts`, `external-operation-resource.ts`). Zadání (bod 4) explicitně žádá jeden sdílený `MasterDataStatus`. **Řešení:** zavést `MasterDataStatus` (`domain/entities/master-data-status.ts`) a předělat tyhle tři aliasy na `export type MachineStatus = MasterDataStatus;` (bezpečná, čistě typová deduplikace - žádná uložená hodnota se nemění, protože litereály jsou stejné).
2. **Čtyři entity používají místo toho Czech `EntityStav` (`"aktivni" | "neaktivni"`):** `OperationType`, `Tool`, `ToolType`, `ToolMachineCondition`. Sémanticky STEJNÝ koncept jako `MasterDataStatus`, jen jiná jména hodnot. **Řešení: NEPŘEJMENOVÁVAT** - je to funkční, jen kosmeticky odlišné, a přejmenování by muselo projít mappery, seed daty, migrací a Krok 4 UI popisky (`activity-table.tsx` aj. čtou `stav`). Zdokumentováno jako vědomě zachovaná nekonzistence (`docs/step-5/known-limitations.md`), přesně to, co zadání v bodě 4 zakazuje vytvářet NOVĚ ("nevytvářej různé názvy pro stejnou věc") - tahle dvojkolejnost už ale existuje z dřívějška, Krok 5 ji nerozšiřuje, jen ji nemaže zpětně.
3. **`MachineCapability` název koliduje sémanticky se zadáním** - viz tabulka výše. Nová entita se bude jmenovat `MachineCapabilityValue`.
4. **`Money` už existuje** (`value-objects/money.ts`) - zadání (bod 15) chce `Money` pro `ExternalOperationResource.defaultCost` - žádná duplicita, přímo použitelné.

## 3. Rizika migrace

1. **`OperationType`/`ToolType` bez `tenantId`.** Přidání `tenantId` (povinné pole) rozbije existující `operation-type-seed.ts`/`seed-reference-data.ts` (seedují bez tenanta) a všechna volání `operationTypeRepository.findAll()`/`toolTypeRepository.findAll()` v Kroku 4 (`get-routing-sheet-editor-use-case.ts`, `release-routing-sheet-use-case.ts`, `calculate-operation-use-case.ts`, `use-routing-sheet-editor.ts`, `routing-sheet-editor-dependencies.ts`). Migrace (`seed-reference-data.ts`) musí začít seedovat s `DEFAULT_TENANT_ID` (stejný vzor jako `migrate-routing-data.ts` z Kroku 4). DB verze musí povýšit na 5 s aditivním indexem `tenantId`/`tenantId_kod` - staré záznamy (verze ≤4, žádný `tenantId`) budou muset dostat `DEFAULT_TENANT_ID` v migračním upgrade kroku (na rozdíl od ostatních aditivních upgradů v `tpv-db.ts` tohle je JEDINÝ případ, kdy Krok 5 musí i BACKFILLOVAT existující řádky, ne jen přidat prázdný index - řeší se v `upgrade()` přímo nad otevřenou verzovací transakcí, čtením a přepsáním existujících záznamů, ne destruktivně).
2. **`ToolRepository`/`MachineCapabilityRepository`/`ToolMachineConditionRepository` nejsou tenant-scoped**, přestože entity `tenantId` mají. Změna signatur (`findById(id, tenantId)` apod.) je zpětně nekompatibilní se stávajícími voláními v Kroku 4 (`get-routing-sheet-editor-use-case.ts` atd. volají `toolRepository.findAll()` bez tenanta) - je nutné je přepsat na `list(tenantId)`.
3. **`Machine.category`/`manufacturer`/`model`/`maxPowerKw` neexistují** - přidání je aditivní (nepovinná pole), nemigruje nic zpětně, bezpečné.
4. **Legacy import strojů/nástrojů** (`/dev/tpv-migration`) čte ze STARÉ databáze (`cnc-casovac`) a vytváří `Machine`/`Tool` bez `category`/`manufacturer`/nových polí - v pořádku, zůstanou `undefined`, uživatel je doplní přes nový formulář.

## 4. Nevyužívané nebo legacy struktury

- `src/infrastructure/persistence/in-memory/` byl smazán v Kroku 4 (dead code) - žádné další in-memory repozitáře k úklidu.
- `ToolMachineCondition.materialId` je připravené, ale nepoužívané pole - Krok 5 ho poprvé skutečně propojí s novou entitou `Material`.

## 5. Formulářová/tabulková knihovna, DI, testy

- **Žádná formulářová knihovna** (`react-hook-form`, `formik`) v `package.json` - Krok 4 psalo formuláře ručně (`useState` + `onBlur`/`onChange`), Krok 5 bude pokračovat stejně.
- **Žádná tabulková komponenta** (`@tanstack/table` apod.) - Krok 4 psalo `<table>` ručně, Krok 5 bude pokračovat stejně, jen s obecnější `MasterDataTable` komponentou pro sdílené sloupce (hledání/filtr/stav).
- **Žádná CSV/XLSX knihovna.** Import/export (zadání body 44-46) bude implementován jako ruční CSV parser/serializer (RFC4180-ish - escapování uvozovek, čárek, nových řádků) bez nové závislosti - konzistentní s "vyhni se overengineeringu" a se stávajícím vzorem JSON exportu (`/dev/tpv-migration`, `downloadReport`).
- **Žádný DI kontejner** - Krok 5 bude pokračovat vzorem `create*Dependencies()` factory funkce zavedeným v `routing-sheet-editor-dependencies.ts` (Krok 4), samostatná factory pro master-data (`master-data-dependencies.ts`).
- **Testovací framework:** `vitest` + `fake-indexeddb`, žádný React testing harness (stejná mezera jako Krok 3.5/4 - zdokumentováno, ne řešeno v tomhle kroku, viz `docs/step-4/known-limitations.md` bod 8).

## 6. Licenční katalog – aktuální stav

`domain/licensing/feature-code.ts` už obsahuje `machines.view/manage/capacity_groups`, `tools.view/manage`, `cooperations.view/manage` (Krok 3.5) - přesně odpovídá zadání bodu 29. Chybí `operation_types.view/manage` a `cutting_conditions.view/manage` (zadání dovoluje doplnit, pokud je to konzistentní - je, protože obě dostávají vlastní CRUD UI v tomhle kroku). `materials.*` se přidá jen pokud se Material entita skutečně implementuje (viz Fáze 8 rozhodnutí níže). `LicenseLimitCode` má `machines.max`, chybí `tools.max`, `capacityGroups.max`, `externalResources.max`, `operationTypes.max` (zadání bod 30).

## 7. Materiály – rozhodnutí

`Part.material?: string` (volný text) je jediné dnešní použití materiálu - kalkulační engine (`src/lib/operations.ts`) na materiálu VŮBEC nezávisí (žádný lookup, žádné vzorce podle materiálu). Jediné funkční využití pro `Material` entitu by bylo přes `ToolMachineCondition.materialId` (připravené, nepoužité pole) a nový `materialGroupId` filtr v `resolveCuttingConditions`. Rozhodnutí: **implementovat minimální `Material`/`MaterialGroup`** přesně podle zadání bodu 22 (žádná rozsáhlá databáze norem) - odůvodněno tím, že `materialId` už čeká na entitu a řezné podmínky ho potřebují k plné funkčnosti. `Part.material` (volný text) se NEPŘEVÁDÍ na FK - zůstává nezávislé pole, žádná fuzzy migrace textu na entitu (mimo rozsah, riziko špatného párování).

## 8. Návrh implementace (shrnutí, detaily viz jednotlivé ADR/docs)

1. Sjednotit anglické stavové aliasy do `MasterDataStatus`, zavést ho pro všechny NOVÉ entity.
2. Přidat `tenantId` na `OperationType`/`ToolType`, tenant-scoped repository pro OBOJE plus `Tool`/`MachineCapability`/`ToolMachineCondition` (DB verze 4→5, backfill `DEFAULT_TENANT_ID`).
3. Nové entity: `CapabilityType`, `MachineCapabilityValue`, `OperationTypeCapabilityRequirement`, `Supplier`, `Material`, `MaterialGroup`.
4. Rozšířit `Machine` (category/manufacturer/model/maxPowerKw), `ExternalOperationResource` (supportedOperationTypeIds/defaultLeadTimeDays/defaultCost), `Tool` (manufacturer/designation/parameters), `ToolType` (parameterDefinitions).
5. Application use cases pro všechny číselníky (CRUD + deaktivace/reaktivace + usage query), sjednocené kontroly (tenant, licence, unikátnost, existence vazeb).
6. UI: `/tpv/master-data/*`, sdílené komponenty (`MasterDataTable`, `MasterDataStatusBadge`, ...), formuláře.
7. Import/export CSV pro Machine/Tool/OperationType (reprezentativní podmnožina, ne všech 9 entit - zdůvodněno v `docs/step-5/import-export.md`).
8. Integrace: Krok 4 editor přepnout z přímého `findAll()` na nové tenant-scoped `list(tenantId)` a filtrovat neaktivní/cizí tenant stejně jako dřív, jen přes opravené repozitáře.
9. Testy: reprezentativní sada (stejný přístup jako Krok 4 - dokumentováno v `docs/step-5/known-limitations.md`, ne tichý výpadek pokrytí).

## 9. Rizika zpětné kompatibility - shrnutí

- Přejmenování `ToolRepository`/`MachineCapabilityRepository`/`ToolMachineConditionRepository`/`OperationTypeRepository`/`ToolTypeRepository` signatur je nekompatibilní změna - VŠECHNA volající místa v Kroku 4 musí být upravena ve STEJNÉM commitu (žádná mezistavová nekonzistence).
- DB verze 4→5 s backfillem `tenantId` na existujících `tpvOperationTypes`/`tpvToolTypes` záznamech - aditivní, ne destruktivní (žádný záznam se nemaže), ale vyžaduje čtení+přepsání v rámci `onupgradeneeded` transakce (bezpečný, IndexedDB-nativní postup, otestovaný stejně jako `migrate-routing-data.ts` idempotence v Kroku 4).
- Legacy appka (`src/app/page.tsx`, `src/components`, `src/lib`, DB `cnc-casovac`) zůstává **zcela nedotčená** - stejný závazek jako v každém předchozím kroku.
