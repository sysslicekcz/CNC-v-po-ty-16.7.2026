# Parametry nástroje definuje jeho typ, ne pevná pole na entitě

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
Nástroje potřebují různé sady technických parametrů podle druhu (vrták má průměr, fréza má počet zubů a povlak, měřidlo nemá žádné z toho). Pevný seznam polí na `Tool` (jako `radius`/`defaultCuttingParameters`, které entita už měla z dřívějška) by se buď musel donekonečna rozšiřovat o nová volitelná pole pro každý nový druh nástroje, nebo by appka musela nést deset polí, z nichž devět je pro danou instanci nesmyslných. Obojí je špatně škálovatelné a zadání (bod 19) explicitně vyžaduje dynamické parametry podle typu.

## Decision
`ToolType.parameterDefinitions: ToolParameterDefinition[]` nese DEFINICI dynamických parametrů (klíč, čitelný název, datový typ, jednotka, povinnost, povolené hodnoty pro výběr) - typ nástroje je datový číselník, ne pevný enum, takže nový druh nástroje (a jeho parametry) se přidává jako datový záznam, ne jako změna schématu.

`Tool.parameters?: Record<string, ToolParameterValue>` nese samotné HODNOTY podle definice svého `toolTypeId`. Validace (povinnost, typ, `allowedValues`) probíhá v `application/tools/validate-tool-parameters.ts` (sdílená čistá funkce, volaná z `CreateToolUseCase`/`UpdateToolUseCase`) - `Tool` sám o sobě `ToolType` nenačítá a nezná jeho definice, validace je vždy explicitní krok v use casu.

Existující pevná pole `radius?`/`defaultCuttingParameters?` ZŮSTÁVAJÍ zachovaná beze změny (ne převedená na dynamické parametry) - řezné podmínky mají vlastní typ (`CuttingParameters`) a jsou používané `cutting-condition-resolver.ts`; převod na obecný bag by riskoval rozbití existující, funkční logiky bez odpovídajícího přínosu.

## Consequences
- Přepnutí typu nástroje (`changeToolType`) NEZAHAZUJE staré `parameters` automaticky - jen je znovu zvaliduje proti definicím nového typu (zadání bod 37, "nemaž hodnoty bez potvrzení"). Volající musí explicitně poslat nové hodnoty, pokud chce staré nahradit.
- UI formulář nástroje se vykresluje dynamicky podle `parameterDefinitions` zvoleného typu (`ParameterInput` komponenta) - žádný pevný formulář na entitu.
- Cena: appka nese dvě různé cesty pro "vlastnosti nástroje" (pevná pole `radius`/`defaultCuttingParameters` vs. dynamický `parameters` bag) - přijato jako menší nekonzistence než riskantní přepis fungující logiky.
