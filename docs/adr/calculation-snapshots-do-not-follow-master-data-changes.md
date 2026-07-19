# Kalkulační snapshoty nesledují pozdější změny kmenových dat

## Status
Přijato (Krok 5 - Správa kmenových dat TPV, potvrzuje `docs/adr/0006` z dřívějška v novém kontextu editovatelných kmenových dat)

## Context
`CalculationSnapshot` (Krok 3/4) zamrazuje identitu/cenu stroje a nástroje V OKAMŽIKU VÝPOČTU (`docs/adr/0006`). Krok 5 poprvé dělá VŠECHNA kmenová data (hodinové sazby, kódy, parametry) skutečně editovatelnými přes UI - vyvstala otázka, jestli by kalkulace neměly zůstat "živé" a přepočítávat se automaticky, když se stroj přejmenuje nebo mu technolog změní hodinovou sazbu.

## Decision
Zachovat a explicitně potvrdit původní princip beze změny: `CalculateOperationUseCase` zapíše `CalculationSnapshot.machineId/machineCode/machineName/machineHourlyRate/toolId/toolCode/toolName/toolTypeId/operationTypeId/operationTypeCode` jako NEMĚNNOU kopii v okamžiku výpočtu. Pozdější `UpdateMachineUseCase`/`UpdateToolUseCase` (Krok 5) mění jen aktuální stav kmenového záznamu - existující `Calculation.snapshot` u už provedených výpočtů zůstává beze změny navždy, dokud se výpočet ručně neopakuje.

Ověřeno testem (`src/application/master-data-routing-integration.test.ts`) - po zaznamenání kalkulace se hodinová sazba stroje explicitně změní a znovu načtený snapshot starší kalkulace pořád nese PŮVODNÍ hodnotu.

## Consequences
- Cena vydaného/rozpracovaného postupu se NEMĚNÍ retroaktivně, když se později upraví sazba stroje nebo přejmenuje nástroj - cena odpovídá tomu, co bylo skutečně vypočítáno v daný okamžik, ne aktuálnímu ceníku.
- Pokud chce uživatel promítnout novou sazbu do existující kalkulace, musí výpočet EXPLICITNĚ zopakovat (`CalculateOperationUseCase` znovu) - appka to nedělá automaticky ani nenabízí hromadný přepočet.
- Tenhle princip se vztahuje na VŠECHNA pole zapsaná do `CalculationSnapshot` - i budoucí rozšíření kmenových dat (nová pole na `Machine`/`Tool`) by měla stejnou logiku dodržet, pokud se rozhodnou zapisovat se do snapshotu.
- Konzistentní s `docs/adr/0022-license-does-not-delete-data.md` a `docs/step-5/master-data-principles.md` (bod 5) - stejně jako licenční limity nemažou existující data, editace kmenových dat nemění existující historické záznamy.
