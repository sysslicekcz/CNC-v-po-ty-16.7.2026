# Editor DTO oddělené od domény

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
Editor UI (React komponenty) potřebuje pro vykreslení hodnoty, které doména samotná nezná nebo nedrží pohodlně - lidsky čitelný název stroje místo `machineId`, informaci o zastaralosti kalkulace, pořadové číslo (`sequence`) upnutí/činnosti, seznam validačních nálezů přiřazený ke konkrétní operaci/upnutí/činnosti. Kdyby tyhle vlastnosti přibyly přímo na doménové entity (`Operation`, `Position`, `Activity`), doména by se stala závislou na prezentačních potřebách UI a nesla by pole, která nemají žádný obchodní význam.

## Decision
Doména (`RoutingSheet`, `Operation`, `Position`, `Activity`) zůstává beze změny - jen `id`, obchodní pole, a odkazy (`machineId`, `toolId`, `operationTypeId`). Mezi doménou a UI stojí čistá, testovatelná mapovací vrstva:

- `RoutingSheetEditorDto` a vnořené DTO (`RoutingOperationEditorDto`, `OperationPositionEditorDto`, `OperationActivityEditorDto`) - immutable snímek stromu obohacený o čitelné hodnoty.
- `toRoutingSheetEditorDto()` (`routing-sheet-editor-mapper.ts`) - čistá funkce `(RoutingSheet, Part, lookups, validationIssues) -> RoutingSheetEditorDto`, žádný side-effect, žádné volání repository uvnitř (lookupy se natáhnou dávkově VENKU, viz zadání bod 48).
- React komponenty NIKDY nemutují doménu ani DTO přímo - všechny mutace jdou přes metody `useRoutingSheetEditor()` hooku, který drží ŽIVÝ `RoutingSheet` agregát v `useRef` a po každé mutaci DTO PŘEPOČÍTÁ (`recomputeDto`), nikdy needituje starý DTO snímek na místě.

## Consequences
- Doména zůstává čistá a testovatelná bez závislosti na UI potřebách (žádné `displayName`, `isStale`, `sequence` pole v `Operation`/`Activity`).
- Mapper je triviálně testovatelný bez DOM/React (viz `routing-sheet-editor-mapper.test.ts`) - čistá vstup/výstup funkce.
- DTO je vždy konzistentní snímek - žádné riziko, že komponenta omylem edituje DTO pole, které se pak nepropíše do domény (DTO je jen pro čtení, zápis jde vždy přes hook).
- Cena: každá mutace vyžaduje po sobě přepočet celého DTO stromu (`recomputeDto`) - u rozsahu jednoho postupu (desítky operací) je to zanedbatelné, u výrazně většího stromu by to vyžadovalo selektivnější přepočet (mimo rozsah Kroku 4).
