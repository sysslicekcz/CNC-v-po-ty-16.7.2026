# Krok 5 – integrace s kalkulacemi (Krok 4)

## `CalculateOperationUseCase` čte kmenová data přes repozitáře, staví zamrzlý snapshot

`application/routing-sheets/calculate-operation-use-case.ts` načte `Machine`/`Tool`/`OperationType` přes jejich repozitáře (tenant-scoped, po opravě z Kroku 5) a zapíše jejich identitu/cenu/název do `CalculationSnapshot` V OKAMŽIKU VÝPOČTU (`docs/adr/0006`, nedotčené Krokem 5). Existující výpočtový engine (`LegacyCalculationEngine`) zůstává beze změny - Krok 5 se ho vůbec nedotkl.

## Snapshot je zamrzlý - následná změna kmenových dat ho nezmění

Ověřeno testem (`src/application/master-data-routing-integration.test.ts`, golden-path integrační test): po zaznamenání kalkulace se hodinová sazba stroje ZMĚNÍ (`UpdateMachineUseCase`), ale znovu načtená `Calculation.snapshot.machineHourlyRate` zůstává PŮVODNÍ hodnota. Viz `docs/adr/calculation-snapshots-do-not-follow-master-data-changes.md`.

## `ResolveCuttingConditionUseCase` existuje, ale NENÍ zapojený do výpočtu

Krok 5 postavil `resolveCuttingConditions`/`ResolveCuttingConditionUseCase` jako samostatnou, funkční cestu (viz `docs/step-5/cutting-conditions.md`) - typicky pro budoucí "navrhni řezné podmínky" tlačítko v kalkulačním panelu. `CalculateOperationUseCase` ho ale v tomto kroku NEVOLÁ - `inputParameters` (Vc/posuv/ap) se do kalkulačního enginu zadávají ručně stejně jako v Kroku 4, žádné automatické předvyplnění z `ToolMachineCondition`.

**Proč vědomě neintegrováno teď:** propojení by vyžadovalo rozhodnutí o UI (kam tlačítko umístit, jak nabídnout výběr mezi víc nalezenými profily) a netriviální úpravu `CalculationPanel` (Krok 4), což by přesáhlo rámec "kmenová data" a začalo zasahovat do samotné kalkulační obrazovky - riziko zbytečného rozšiřování scope uprostřed jiného kroku. Zdokumentováno jako explicitní kandidát na příští krok, ne přehlédnutá mezera - viz `docs/step-5/known-limitations.md` a `docs/step-5/step-6-readiness.md`.

## Co se NEMĚNÍ

- Algoritmus výpočtu (`LegacyCalculationEngine`) - beze změny.
- Struktura `CalculationSnapshot` - beze změny (žádná nová pole přidaná Krokem 5).
- Licenční kontrola kalkulace (`calculations.basic`/`calculations.advanced`) - beze změny.
