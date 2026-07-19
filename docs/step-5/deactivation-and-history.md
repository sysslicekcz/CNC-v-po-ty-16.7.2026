# Krok 5 – deaktivace a ochrana historických dat

## Preferovaná cesta: deaktivace

Každá kmenová entita má `setStatus`/`setStav` a odpovídající `Deactivate*UseCase`/`Reactivate*UseCase` - NIKDY nemažou záznam, jen přepnou stav. Historické odkazy (`Operation.machineId`, `Activity.toolId`, `CalculationSnapshot.machineId/toolId`, ...) zůstávají čitelné, i když se stroj/nástroj/kooperace mezitím deaktivuje.

## Fyzické smazání - jen kde dává smysl a je chráněné

Ne všechny entity mají smazání vůbec: `Machine`, `CapacityGroup`, `ExternalOperationResource` ho mají (`Delete*UseCase`), `OperationType`/`ToolType`/`Tool`/`ToolMachineCondition`/`Material`/`MaterialGroup`/`Supplier`/`CapabilityType` ho NEMAJÍ (deaktivace je jediná cesta) - konzistentní s tím, že smazání je vždy rizikovější než deaktivace a zadání ho vyžaduje jen tam, kde je explicitně užitečné (např. omylem založený stroj s překlepem v kódu, ještě nepoužitý).

Tam, kde smazání existuje, kontroluje `MasterDataUsageChecker` (`domain/services/master-data-usage-checker.ts`, implementace `infrastructure/persistence/indexeddb/default-master-data-usage-checker.ts`) PŘED smazáním - pokud je záznam používaný, vyhodí se `MasterDataInUseError` s volitelným lidsky čitelným shrnutím a smazání se odmítne.

### Konzervativní rozsah kontrol

Protože `Operation`/`Activity` (Krok 4) nejsou tenant-scoped přímo (izolace jde přes `RoutingSheet` jako aggregate root), kontroly použití stroje/nástroje/typu operace/kooperace jsou ZÁMĚRNĚ globální/konzervativní sken (nikdy méně bezpečné, jen případně přehnaně opatrné) - naproti tomu kontroly `capacityGroup`/`materialGroup` řádně tenant-filtrují přes existující `tenantId` pole na `Machine`/`Material`. Některé kontroly používají plný `tpvGetAll` sken tabulky, kde neexistuje index (`Activity.toolId`, `Operation.externalResourceId`) - vědomý kompromis, aby se nemusela dělat další DB verze jen kvůli delete-guardům.

## Sdílené chybové třídy

`domain/errors/master-data-errors.ts` - JEDNA parametrizovaná třída na chybu (`MasterDataCodeAlreadyExistsError`, `MasterDataInUseError`, `MasterDataInactiveError`, `InvalidMasterDataValueError`) reused napříč VŠEMI novými entitami, místo sedmi skoro identických tříd. Starší entitně specifické třídy (`MachineCodeAlreadyExistsError` apod. z Kroku 3.5) zůstávají beze změny - vytvořit jim ekvivalent pro každou novou entitu by byla přesně ta duplicita, kterou zadání zakazuje; existující fungují, přejmenování by bylo zbytečná churn.

## Nové přiřazení neaktivního záznamu

`MasterDataInactiveError` - pokus o NOVÉ přiřazení neaktivního kmenového záznamu se zamítne (např. `CreateToolUseCase` na neaktivním `ToolType`). Už existující historické přiřazení zůstává beze změny, jen nová vazba je zakázaná.
