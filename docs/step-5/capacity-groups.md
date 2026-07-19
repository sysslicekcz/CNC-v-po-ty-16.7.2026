# Krok 5 – skupiny kapacity

`CapacityGroup` (`src/domain/entities/capacity-group.ts`) existovala už z Kroku 3.5 přesně podle zadání - Krok 5 jen doplnil chybějící mutátory (`changeCode()`, `setNote()`, objevené při psaní `UpdateCapacityGroupUseCase` - use case volal kontrolu unikátnosti kódu, ale entita neměla metodu, kterou by kód skutečně změnila; doplněno) a application use casy: `update-capacity-group-use-case.ts`, `deactivate-capacity-group-use-case.ts`, `reactivate-capacity-group-use-case.ts`, `delete-capacity-group-use-case.ts` (chráněné usage checkerem), `list-capacity-groups-use-case.ts`.

## Účel

Sdílená fyzická kapacita reprezentovaná víc podnikovými kódy strojů (např. `300-58140`/`300-58141` = dva `Machine` záznamy, jedna fyzická skupina). Žádné plánování/kalendáře/Gantt - jen model a persistence (mimo rozsah zadání, viz `docs/adr/0017-shared-capacity-groups.md`).

## UI

`/tpv/master-data/capacity-groups` - jednoduchý seznam + formulář (kód, název, poznámka) + deaktivace/reaktivace/smazání. Přiřazení STROJE ke skupině se dělá na stránce Stroje (`assignMachineToCapacityGroupUseCase`), ne tady - skupina sama žádný seznam připojených strojů nespravuje jako vlastní pole (odvozuje se přes `Machine.capacityGroupId`).

## Ochrana použitých dat

`DeleteCapacityGroupUseCase` používá `MasterDataUsageChecker.isCapacityGroupInUse()` (`infrastructure/persistence/indexeddb/default-master-data-usage-checker.ts`) - kontroluje, jestli na skupinu ukazuje nějaký `Machine.capacityGroupId` v rámci tenanta (tenant-scoped kontrola, protože `Machine` má `tenantId`). Pokud ano, smazání se odmítne (`MasterDataInUseError`) a uživatel dostane návod deaktivovat místo smazání.
