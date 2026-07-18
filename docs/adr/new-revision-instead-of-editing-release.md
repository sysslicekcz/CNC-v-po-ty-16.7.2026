# Nová revize místo úpravy vydaného postupu

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
Vydaný ("released") technologický postup je referenční dokument pro výrobu - operátoři a kontrola se na něj spoléhají jako na neměnnou pravdu. Zadání (bod 4) požaduje, aby vydaný postup nešel přímo editovat, a aby jedinou cestou ke změně bylo vytvoření nové revize. Otázka byla, KDY se stará revize archivuje - hned při založení nové, nebo až při vydání té nové.

## Decision
`CreateRoutingSheetRevisionUseCase` vyžaduje zdrojový postup ve stavu `released` a v jednom kroku:
1. vytvoří kompletní kopii stromu (Operation → Position → Activity → Calculation) jako nový `draft` s revizí `n+1` (`cloneRoutingSheetAsNewDraft`),
2. zdrojovou revizi OKAMŽITĚ archivuje (`RoutingSheet.archive()`), ne až při vydání nové revize.

Archivace hned při založení nové revize (ne při jejím vydání) je záměrná - jinak by mohly krátkodobě existovat DVĚ "released" revize současně (stará ještě released, nová dopracovaná a taky released), což by bylo matoucí a otevíralo prostor pro nekonzistenci ("která revize je aktuální?").

Zdroj zároveň ztrácí příznak `isDefault` (`source.clearDefault()`) a nová revize ho dostává (`isDefault: true` v `cloneRoutingSheetAsNewDraft`) - díl má vždy nejvýš jednu výchozí `RoutingSheet` (invariant hlídaný i `post-validation.ts`).

Na jeden díl smí existovat nejvýš jeden `draft` současně (`findDraftByPartId` check) - nelze rozpracovat dvě revize paralelně.

## Consequences
- Vydaný postup je od okamžiku vydání navždy needitovatelný (`assertEditable()` v doméně to vynucuje) - jediná cesta ke změně je nová revize.
- Historie revizí je souvislá a dohledatelná přes `previousVersionId`.
- Nikdy neexistují dvě "released" revize stejného dílu současně.
- Nikdy neexistují dvě "výchozí" (`isDefault`) revize stejného dílu současně.
- Vedlejší efekt: založení nové revize je nevratná operace (zdroj se archivuje ihned) - pokud technolog revizi nakonec nechce, musí ji smazat/nechat ležet jako draft; zdrojová revize zůstává archivovaná (data se neztrácí, jen změní stav).
