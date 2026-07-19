# Podnikové kódy jsou unikátní v rámci tenanta, nikdy globálně

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
`docs/adr/0019-tenant-aware-data-model.md` (Krok 3.5) zavedl tenant-scoped model pro `Machine`/`CapacityGroup`/`ExternalOperationResource`, ale `OperationType`/`ToolType` zůstaly globální seedované číselníky bez `tenantId` - fungovalo to, dokud byly čistě systémová, needitovatelná data. Krok 5 je poprvé zpřístupňuje jako uživatelsky editovatelná kmenová data (formulář v UI, vlastní kódy zadávané uživatelem) - bez tenant scope by jeden tenant viděl (a mohl přepsat) typy operací založené jiným tenantem, což je datová izolace, kterou appka jinde důsledně dodržuje.

## Decision
`OperationType`/`ToolType` dostávají povinné `tenantId: string` a jejich repozitáře se přepisují na tenant-scoped rozhraní (`findById(id, tenantId)`, `findByCode(tenantId, kod)`, `list(tenantId)`) - stejný vzor jako `Machine`/`CapacityGroup` z Kroku 3.5. Zároveň se opravuje latentní mezera u `Tool`/`MachineCapability`/`ToolMachineCondition` - tyhle entity `tenantId` už měly, ale jejich repository rozhraní bylo pořád generické `Repository<T>` bez tenant parametru (nikdy prakticky neprojevená chyba s jedním tenantem, ale objektivně nesprávná izolace).

Migrace existujících dat (DB verze 4 → 5) BACKFILLUJE staré řádky `tpvOperationTypes`/`tpvToolTypes` přes `IDBObjectStore.openCursor()` + `cursor.update()` - první backfillující (ne čistě aditivní) upgrade v projektu, viz `infrastructure/persistence/indexeddb/tpv-db.ts`.

## Consequences
- Kód (`M-1`, `KOOP-TEP`, ...) může kolidovat MEZI tenanty (dva tenanty mohou mít vlastní stroj s kódem `M-1`), ale NIKDY uvnitř jednoho tenanta - unikátnost kontroluje use case přes `findByCode(tenantId, code)` PŘED zápisem.
- Krok 4 kód, který dřív volal `operationTypeRepository.findAll()`/`toolRepository.findAll()` bez tenanta, musel být přepsán na `list(tenantId)` - zpětně nekompatibilní změna rozhraní, vynucená a odhalená typovým systémem (`tsc --noEmit`), ne za běhu.
- Backfill migrace je jednosměrná - stará data (verze ≤4) po upgradu automaticky dostanou `DEFAULT_TENANT_ID`, žádný ruční krok navíc.
