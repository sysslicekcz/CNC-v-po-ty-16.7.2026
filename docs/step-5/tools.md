# Krok 5 – nástroje

## Rozšíření entity

`Tool` (`domain/entities/tool.ts`) měla `id`, `tenantId`, `code?`, `nazev`, `toolTypeId`, `stav`, `radius?`, `defaultCuttingParameters?`, `poznamka?`. Krok 5 přidal:

- `manufacturer?: string`, `designation?: string`.
- `parameters?: Record<string, ToolParameterValue>` - dynamické hodnoty podle `ToolType.parameterDefinitions` (viz `docs/step-5/tool-types.md`). `radius`/`defaultCuttingParameters` zůstávají zachovaná PEVNÁ pole z dřívějška (řezné podmínky mají vlastní typ, ne obecný bag), aby se nerozbilo nic, co na nich stojí (`cutting-condition-resolver.ts`).

Entita přestala být immutable - `rename()`, `changeCode()`, `changeToolType()`, `updateDetails()`, `setStav()`.

## Tenant scope repository (oprava latentní mezery)

`ToolRepository` měla z dřívějška generické `Repository<Tool>` rozhraní BEZ `tenantId` parametru, přestože `Tool.tenantId` existovalo - latentní izolační mezera (nikdy prakticky neprojevená s jedním tenantem, ale objektivně chyba). Krok 5 přepsal rozhraní i implementaci na tenant-scoped (`findById(id, tenantId)`, `list(tenantId)`, ...) - stejná oprava jako u `MachineCapabilityRepository`/`ToolMachineConditionRepository`.

## Validace dynamických parametrů

`application/tools/validate-tool-parameters.ts` (čistá funkce) validuje `Tool.parameters` proti `ToolType.parameterDefinitions` (povinnost, datový typ, `allowedValues`) PŘED uložením - sdílená mezi `CreateToolUseCase`/`UpdateToolUseCase`, aby se pravidlo neduplikovalo. Přepnutí typu nástroje (`changeToolType`) NEZAHAZUJE staré parametry automaticky (zadání bod 37 - "nemaž hodnoty bez potvrzení") - jen je znovu zvaliduje proti definicím NOVÉHO typu; volající (UI/use case) musí explicitně poslat nové `parameters`, pokud chce staré nahradit.

## UI

`/tpv/master-data/tools` - nástroje + rozbalitelná sekce typů nástrojů na stejné stránce. Formulář nástroje dynamicky vykresluje pole podle `parameterDefinitions` zvoleného typu (`ParameterInput` komponenta - text/číslo/ano-ne/výběr podle `valueType`).
