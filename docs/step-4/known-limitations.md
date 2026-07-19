# Krok 4 – známá omezení

Vědomě přijatá omezení a mezery objevené při implementaci/ručním testování, ne přehlédnuté chyby. Každé má odkaz na to, proč je přijatelné teď a co by ho řešilo příště.

1. **Snapshot vydaného postupu (`ReleasedRoutingSheetSnapshot`) není zapojený do zobrazení.** `GetReleasedRoutingSheetUseCase` existuje a je otestovaný, ale editor (`/tpv/routing-sheets/[id]`) pro READ-ONLY zobrazení vydaného postupu čte živou `RoutingSheet` (stejnou cestou jako draft), ne snapshot. Snapshot se korektně vytváří při vydání, jen zatím nemá vlastní zobrazovací cestu. Riziko je dnes nízké (živá `RoutingSheet` je needitovatelná), ale přesně scénář "stroj se po vydání přejmenuje" je důvod, proč snapshot vznikl - viz `docs/step-4/release-snapshot.md`.

2. **Žádný tiskový výstup pro vydaný postup.** Existující `.print-area`/`window.print()` vzor z legacy appky se v tomhle kroku neaplikoval na `RoutingSheetEditorPage` ani na budoucí "zobrazit vydaný postup" obrazovku - vydaný postup jde jen prohlížet v prohlížeči, ne vytisknout jako samostatný dokument.

3. **`CalculationPanel` je zjednodušený oproti legacy `AddKonturaModal`.** Chybí automatické řetězení hodnot mezi řádky (`chainFrom`) a předvyplnění z katalogu nástrojů (`fromTool`) - řádky se zadávají ručně. Viz `docs/step-4/calculations.md`.

4. **Zastaralost kalkulace se detekuje jen podle změny zdroje (stroj/nástroj), ne podle změny vstupních parametrů.** Změna materiálu/rozměrů/řezných podmínek nezpůsobí varování o zastaralé kalkulaci. Viz `docs/step-4/calculations.md`.

5. **`calculations.advanced` licenční kód je připravený, ale nevynutitelný.** Doména nerozlišuje "základní" a "pokročilé" typy kalkulace - není co licencovat odděleně. Viz `docs/step-4/licensing.md`.

6. **Žádné drag-and-drop přeuspořádání.** `dnd-kit` není nainstalovaný, reorder funguje jen přes tlačítka ↑/↓. Viz `docs/step-4/positions-and-activities.md`.

7. **Odstranění operace/upnutí/činnosti nemá potvrzovací dialog.** Tlačítko "Odstranit"/"✕" maže OKAMŽITĚ po kliknutí, bez "opravdu smazat?" kroku - u operace to může smazat celý vnořený strom upnutí/činností jedním kliknutím. Draft je sice pořád obnovitelný ručním přidáním zpět, ale ne undo. Zvážit potvrzovací dialog nebo undo mechanismus v příštím kroku.

8. **Žádný React testing harness (stejné jako Krok 3.5).** Projekt nemá `@testing-library/react`/`jsdom` v devDependencies - `vitest` běží v Node prostředí bez DOM. Testy pro Krok 4 proto pokrývají doménu, application use casy, mapper a migraci (přes `fake-indexeddb`), ale NE skutečné vykreslení React komponent do DOM ani simulaci uživatelských kliknutí přes testing library. Editor byl funkčně ověřen ručně v prohlížeči (Playwright smoke test - vytvoření dílu, přiřazení stroje, přidání upnutí/činnosti, výpočet, uložení, vydání, read-only režim, nová revize), ne automatizovanými component testy.

9. **Testová sada je reprezentativní, ne vyčerpávající vůči zadání (body 57-64, ~70 scénářů).** Pokryty jsou klíčové cesty domény (revize, archivace, `isDefault`, přiřazení zdroje, reorder), application use casů (založení, uložení s optimistickou kontrolou, vydání s blokující validací, revize, duplikace), validace (všechna pravidla), migrace (idempotence) a jeden plný integrační scénář (díl → draft → operace → upnutí/činnost → uložení → vydání → revize → immutable snapshot). Nepokryté kombinace (např. všechny kombinace licenčních stavů × akcí, nebo kompletní UI klávesové zkratky) nejsou otestované jednotlivě - zdokumentováno místo tichého vynechání, viz `docs/audits/step-4-audit.md`.

10. **`Part`/`Customer`/`Order` zůstávají netenant-scoped (zděděné omezení z Kroku 3.5, `docs/adr/0019`).** `RoutingSheet` je tenant-scoped (Krok 4 rozšíření), ale `partRepository.findById()` uvnitř use casů kontrolu tenant scope dílu neprovádí (díl sám o sobě žádný `tenantId` nemá) - viz komentáře v `create-routing-sheet-use-case.ts`/`release-routing-sheet-use-case.ts`.

11. **`ToolRepository`/`OperationTypeRepository` zůstávají netenant-scoped** (zděděné z Kroku 3.5) - editor je používá jako globální číselníky, ne per-tenant.

12. **Rozbalený/sbalený stav upnutí (`collapsed` v `OperationPositionList`) se nepersistuje** - po reloadu stránky jsou všechna upnutí zase rozbalená (výchozí stav).

13. **Opakovaný běh migrace nově BEZPEČNĚ přeskočí už migrované díly** (oprava provedená v tomto kroku, viz `docs/step-4/migration-and-legacy.md`), ale přeskočená data se ani nepokusí sloučit s novějšími legacy změnami (např. pokud se legacy pozice/řádky mezitím upravily) - "skip celý díl" je jednoduché a bezpečné pravidlo, ne inteligentní merge.
