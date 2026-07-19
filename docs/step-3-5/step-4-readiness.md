# Připravenost na Krok 4 (editor postupů)

Krok 3.5 explicitně nezaváděl novou editorovou UI pro postupy - jen připravil doménu/persistenci/licenci tak, aby Krok 4 (editor postupů) mohl stavět na stabilním základě. Tenhle dokument shrnuje, co bude editor potřebovat a kde to najde.

## Jak bude editor načítat stroje

Přes `MachineRepository.list(tenantId)` (tenant-scoped, `src/domain/repositories/machine-repository.ts`) - vrátí `Machine[]` pro aktuálního tenanta (`TenantContext.requireCurrentTenantId()`). Pro našeptávač/vyhledávání podle podnikového kódu je k dispozici `ResolveMachineByCodeUseCase`. Editor by měl zobrazovat `Machine.code + " – " + Machine.name` (ne jen `name`) - kód je pro uživatele obeznámeného se svým ERP (ať už je to Helios, SAP, nebo cokoliv jiného) primární identifikátor.

## Jak Operation ukládá vazbu na stroj

Beze změny od Kroku 2 - `Operation.machineId: string | undefined` odkazuje na `Machine.id` (interní stabilní identita, ne `code`). Editor při výběru stroje z UI (kde se zobrazuje `code + name`) musí do `Operation.machineId` uložit `Machine.id`, ne `Machine.code`.

## Jak editor zobrazí kód a název stroje

`Machine.code.toString()` a `Machine.name` - obě pole jsou dnes na entitě přímo dostupná (žádné asynchronní dotazování navíc, pokud editor už má `Machine` načtený). Pro zobrazení HISTORICKÉHO kalkulačního záznamu (starší `Calculation`) editor NEMÁ sahat na aktuální `Machine` - použije zamrzlé `CalculationSnapshot.machineCode`/`machineName`/`machineHourlyRate`, které se nezmění ani po pozdějším přejmenování/přecenění stroje (viz `calculation-snapshot.test.ts`).

## Jak editor získá FeatureAccessSnapshot

Na začátku načtení stránky/komponenty zavolá `GetFeatureAccessSnapshotUseCase.execute()` jednou a výsledek (`FeatureAccessSnapshot`) předá dolů přes props/context do `FeatureGate` komponent. Snapshot se NEMÁ dotazovat opakovaně za každé tlačítko zvlášť - jedno načtení pro celou obrazovku/session.

## Jak bude fungovat režim jen pro čtení podle licence

`FeatureGate` s `requiredAccess="write"` skryje/zablokuje editační akce, když licence pro danou funkci vrací jen `"read"` - ale to je JEN UX. Skutečné vynucení musí být v use casu editoru (např. budoucí `UpdateOperationUseCase` musí volat `featureAccessService.require(FeatureCodes.RoutingEdit, "write")` stejně jako to dnes dělá `UpdateMachineUseCase` pro `MachinesManage`), viz `docs/adr/0021`.

## Které use casy Krok 4 musí licenci kontrolovat

Cokoliv, co mění `RoutingSheet`/`Operation`/`Position`/`Activity` (editace postupu) musí kontrolovat `FeatureCodes.RoutingEdit`; uvolnění/schválení postupu (pokud takový workflow Krok 4 zavede) musí kontrolovat `FeatureCodes.RoutingRelease` - obě funkce už jsou v katalogu (`FeatureCode`), ale v dnešní výchozí licenci (`seed-default-tenant.ts`) je zapnuté jen `routing.view`/`routing.edit` (`routing.release` NENÍ v licenci, protože appka dnes žádný release workflow nemá - jakmile Krok 4 workflow zavede, je potřeba defaultní licenci vědomě rozšířit, ne spoléhat na to, že funkce "nějak projde").

## Pokud Krok 4 přidá zobrazení vazby na externí systém

Editor NEMÁ přidávat žádné ERP-specifické pole na `Machine`/`Operation` ani nikam do domény - existuje-li potřeba zobrazit "s jakým ERP záznamem je tenhle stroj spárovaný", jde o dotaz `ExternalReferenceRepository.findByLocalEntity(tenantId, "machine", machine.id)` (může vrátit víc záznamů napříč víc systémy), ne nové pole na entitě. Viz `docs/step-3-5/erp-integration.md` a `docs/adr/external-system-reference-mapping.md`.

## Co Krok 4 NEMUSÍ řešit znovu

Tenant-scoping strojů/nástrojů, unikátnost `MachineCode`/`ToolCode`, licenční infrastruktura (`FeatureAccessService`, snapshoty), `CapacityGroup`/`ExternalOperationResource` model, ERP-neutrální integrační vrstva (`ExternalSystem`/`ExternalReference`/`ErpConnector`/`ErpConnectorRegistry`) - to všechno už existuje a je otestované. Krok 4 se soustředí na samotnou editorovou UI a use casy pro editaci postupu.
