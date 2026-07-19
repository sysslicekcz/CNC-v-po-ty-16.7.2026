# Autosave a obnova rozpracovaných dat

## Autosave

- Funguje JEN pro draft (read-only postup se nikdy neautoukládá).
- Debounced 1500 ms (`setTimeout` v `scheduleAutosave()`) - série rychlých úprav vygeneruje jeden zápis, ne zápis po každém kliknutí.
- `save()` (explicitní uložení - tlačítko "Uložit" nebo Ctrl/Cmd+S) VŽDY nejdřív zruší pending autosave timer, aby nedošlo k duplicitnímu/soupeřícímu zápisu.
- `release()`/`createRevision()` vždy nejdřív provedou explicitní `save()` PŘED vlastní akcí - vydání nikdy neproběhne nad neuloženými změnami.

## Stavový indikátor (`SaveStatusIndicator`)

`SaveStatus = "idle" | "saving" | "saved" | "unsaved" | "error"` - vždy viditelný, nikdy tichý. Chyba uložení (`saveStatus: "error"`) zobrazuje `saveError` text - autosave selhání se NIKDY neschovává, uživatel ho vždy uvidí.

## `useUnsavedChangesGuard`

`beforeunload` listener aktivní, dokud je `dirty === true` - zabraňuje ztrátě neuložených změn při zavření karty/reloadu.

## Vědomé rozhodnutí: ŽÁDNÝ samostatný recovery buffer

Zadání (bod 16) zvažuje samostatný localStorage/sessionStorage recovery buffer pro obnovu při pádu prohlížeče. Krok 4 ho VĚDOMĚ NESTAVÍ - existující IndexedDB autosave už trvale persistuje draft (přežije reload i pád prohlížeče/tabu), takže paralelní buffer by byl duplicitní zdroj pravdy bez přidané hodnoty. Jediné reálné "okno rizika" je interval mezi poslední úpravou a odloženým autosave zápisem (max. 1500 ms) - ztráta dat v tomhle okně je stejné riziko, jaké nese KAŽDÝ debounced autosave systém, ne specifická mezera Kroku 4.
