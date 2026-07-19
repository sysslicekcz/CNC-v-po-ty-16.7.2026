# Editor drží živý doménový agregát, ne mikro use casy na pole

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
Editor umožňuje desítky drobných lokálních akcí (přejmenovat operaci, přesunout upnutí, změnit poznámku, přiřadit nástroj, ...). Naivní přístup by pro každou z nich zavedl vlastní application use case (`RenameOperationUseCase`, `MoveOperationUseCase`, `AssignToolUseCase`, ...) volaný přes repository při KAŽDÉ drobné změně - desítky tříd a desítky zápisů do IndexedDB za minutu psaní. Zadání (bod 43) to explicitně zakazuje: "nevytvářej zbytečně síť velmi malých persistence use cases".

## Decision
`useRoutingSheetEditor()` hook drží ŽIVOU, mutovatelnou instanci `RoutingSheet` (doménový agregát) v `useRef`. Všechny lokální úpravy (přidání/odebrání/přeuspořádání operací, upnutí, činností; přiřazení zdroje; ruční časy) volají PŘÍMO synchronní metody agregátu (`routingSheet.addOperation(...)`, `routingSheet.movePosition(...)`, ...) - žádná persistence, žádný network/IndexedDB zápis při každém kliknutí.

Centrální `mutate(fn)` wrapper obaluje každou takovou akci: zavolá `fn(routingSheet)`, zachytí doménové chyby (`InvalidStateError`, `ValidationError`, ...), po úspěchu přepočítá DTO (`recomputeDto`, viz `docs/adr/editor-dto-separated-from-domain.md`), označí stav jako "dirty" a naplánuje debounced autosave.

Persistenci/network mají na starosti JEN skutečné use casy, které dělají něco, co in-memory mutace nezvládne - `SaveRoutingSheetDraftUseCase` (zápis do IndexedDB), `CalculateOperationUseCase` (spuštění kalkulačního enginu), `ReleaseRoutingSheetUseCase`, `CreateRoutingSheetRevisionUseCase`, `DuplicateRoutingSheetUseCase` (síťové/transakční operace s vedlejšími efekty přes tenanta/licenci).

## Consequences
- Editor je odezvově okamžitý - lokální mutace jsou synchronní JS volání, ne asynchronní round-trip na IndexedDB.
- Autosave (debounced, viz `docs/step-4/autosave-and-recovery.md`) šetří IndexedDB zápisy - desítky drobných úprav se zapíšou jako jeden zápis po odmlce, ne jeden zápis na úpravu.
- Cena: hook musí ručně udržovat konzistenci mezi živým agregátem (`useRef`) a vykreslovaným DTO (`useState`) - řeší to jediný `mutate()` wrapper, který obě strany vždy sesynchronizuje po každé mutaci (žádná jiná cesta k mutaci agregátu v editoru neexistuje).
- Tenhle vzor je specifický pro EDITOR (jedna otevřená relace, jeden uživatel) - nehodí se pro scénáře, kde by více nezávislých klientů mutovalo stejný agregát souběžně bez znalosti o sobě navzájem.
