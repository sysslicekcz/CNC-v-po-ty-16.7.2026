# Krok 5 – integrace s editorem technologického postupu (Krok 4)

## Editor konzumuje kmenová data JEN přes repozitáře/use casy

`use-routing-sheet-editor.ts` (`fetchLookups()`) načítá `Machine`/`ExternalOperationResource`/`OperationType`/`Tool` přes jejich repozitáře (`deps.machineRepository.list(tenantId)` atd.) - nikdy přímý přístup k IndexedDB, ověřeno staticky (`src/architecture-tests/master-data-layering.test.ts`) i ručně (`grep` po celém `presentation`/`application` - žádný `openTpvDb`/`indexedDB`/`tpvGetAll`).

## Tenant-scoping oprava (dopad Kroku 5 na Krok 4 kód)

Protože Krok 5 přepsal `OperationTypeRepository`/`ToolRepository`/`MachineCapabilityRepository`/`ToolMachineConditionRepository` na tenant-scoped rozhraní, VŠECHNA volání `findAll()` v Kroku 4 kódu musela být přepsána na `list(tenantId)`/`findById(id, tenantId)`: `get-routing-sheet-editor-use-case.ts`, `release-routing-sheet-use-case.ts`, `calculate-operation-use-case.ts`, `use-routing-sheet-editor.ts`, `routing-sheet-editor-dependencies.ts` (plus odpovídající testy). Bez tenhle úpravy by Krok 4 přestal kompilovat/fungovat - typový systém (`tsc --noEmit`) tuhle konzistenci vynutil.

## Neaktivní zdroje se nenabízí pro NOVÉ přiřazení

`RoutingSheetEditorState.availableMachines`/`availableExternalResources` už z Kroku 4 filtrovaly na `status === "active"` - beze změny principu, jen teď filtrují přes opravené tenant-scoped repozitáře. Krok 5 objevil a opravil analogickou mezeru u nástrojů: `state.tools` (dřív neflitrovaný seznam) byl přejmenovaný na `state.availableTools`, filtrovaný na `stav === "aktivni"` - dřív šlo přiřadit i deaktivovaný nástroj k nové/měněné činnosti, protože `Tool.stav` byl před Krokem 5 immutable a filtr proto nebyl potřeba. Beze změny zůstává `toolName` na DTO (`RoutingOperationEditorDto`), který se resolvuje z PLNÉHO seznamu nástrojů (`toolsById` mapa v mapperu) - už přiřazený, mezitím deaktivovaný nástroj se u existující činnosti zobrazuje pod svým jménem dál, jen nejde znovu vybrat z dropdownu pro novou činnost.

## Co NENÍ propojené (vědomě, viz `docs/step-5/integration-with-calculations.md`)

`OperationTypeCapabilityRequirement` (vazba typ operace → vyžadovaná vlastnost stroje) NEFILTRUJE nabídku strojů v `ResourceSelector` - editor Kroku 4 o existenci téhle vazby vůbec neví. Zadání explicitně omezuje rozsah Kroku 5 na "jen správu vazeb, žádný automatický výběr stroje" - filtrování/doporučování je připravený podklad pro pozdější krok, viz `docs/step-5/step-6-readiness.md`.
