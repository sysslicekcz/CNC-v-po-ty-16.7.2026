# Transakční uložení celého stromu RoutingSheet

## Status
Přijato (Krok 3, potvrzeno a rozšířeno v Kroku 4)

## Context
`RoutingSheet` je Aggregate Root nad stromem Operation → Position → Activity → Calculation, persistovaným napříč pěti IndexedDB stores (`tpvRoutingSheets`, `tpvOperations`, `tpvPositions`, `tpvActivities`, `tpvCalculations`). Editor umožňuje v jedné relaci desítky lokálních mutací (přidání/odebrání/přeuspořádání operací, upnutí, činností) předtím, než se uloží. Bez transakční záruky by částečně dokončený zápis (např. výpadek prohlížeče uprostřed ukládání) mohl zanechat strom v nekonzistentním stavu (osiřelé záznamy, chybějící Activity patřící k neexistující Position).

## Decision
`IndexedDbRoutingSheetRepository.save()` pracuje nad JEDNOU IndexedDB transakcí napříč všemi pěti stores: nejdřív smaže CELÝ starý podstrom podle id (delete-old-subtree), pak zapíše celý nový stav (write-new) - vše v jedné transakci, žádné dílčí commity. `findById()`/`delete()` stejně tak čtou/mažou celý podstrom atomicky.

Tenhle vzor (celý agregát = jedna transakce) byl zaveden v Kroku 3 a Krok 4 ho beze změny rozšířil o nová pole (`tenantId`, `popis`, časy operace, `externalResourceId`, ...) a o pátý typ entity beze změny principu.

Krok 4 přidal nad tenhle základ `SaveRoutingSheetDraftUseCase` s volitelnou optimistickou konkurenční kontrolou (`expectedUpdatedAt`) - řeší scénář "dvě otevřené karty prohlížeče editují stejný draft", ne souběžnost na úrovni samotného IndexedDB zápisu (ten transakce řeší sama).

## Consequences
- Reload stránky/pád prohlížeče uprostřed ukládání nikdy nezanechá napůl zapsaný strom - buď je vidět starý kompletní stav, nebo nový kompletní stav.
- Cena: celý strom se při KAŽDÉM uložení znovu zapíše (delete + insert), ne diff. U rozsahu jednoho postupu (desítky záznamů) je to zanedbatelné; u výrazně většího stromu by šlo zvážit granulárnější zápis (mimo rozsah Kroku 3/4).
- `SaveRoutingSheetDraftUseCase.expectedUpdatedAt` je základ pro budoucí vícenávštěvníkovou spolupráci, ale v dnešní appce (jeden uživatel, IndexedDB v prohlížeči) konflikt reálně nastává jen výjimečně (dvě karty).
