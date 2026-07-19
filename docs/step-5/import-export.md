# Krok 5 – import a export

## Generický, ERP-neutrální CSV

`src/presentation/master-data/csv-utils.ts` - vlastní RFC4180-ish parser/serializer (uvozovky, escapované `""`, čárky/nové řádky uvnitř uvozovaných buněk), žádná nová závislost (projekt nemá CSV/XLSX knihovnu, viz `docs/audits/step-5-audit.md`, oddíl 5). Záměrně BEZ zmínky konkrétního ERP v názvu čehokoliv - stejný princip jako `docs/adr/erp-agnostic-integration-layer.md`.

`stringifyCsv()` sanitizuje export proti CSV/formula injection (OWASP) - buňka začínající `=`, `+`, `-`, `@`, tabulátorem nebo `\r` dostane apostrof navíc, který spreadsheet (Excel/Sheets) zobrazí jako text, ne spustí jako vzorec. Otestováno (`csv-utils.test.ts`).

## Export - napříč všemi 8 sekcemi

`ExportCsvButton` (sdílená komponenta) je na každé stránce `/tpv/master-data/*` - staví CSV z aktuálně načteného seznamu, stahuje přes `Blob` + dočasný `<a download>` odkaz (stejný vzor jako `downloadReport` na `/dev/tpv-migration`).

## Import - preview před commitem, jen pro Machine

Zadání vyžaduje "preview před commitem" a "transakční aplikaci přes use casy, nikdy přímý zápis do IndexedDB z importéru" - obojí implementováno v `MachineCsvImportPanel` (`presentation/master-data/components/machine-csv-import-panel.tsx`):

1. Soubor se lokálně rozparsuje a zvaliduje (`buildPreview()`, čistá funkce, testovaná odděleně od komponenty) - BEZ jakéhokoliv zápisu.
2. Uživatel vidí náhledovou tabulku se stavem každého řádku (OK / důvod chyby).
3. Až po potvrzení se řádky aplikují JEDNOTLIVĚ přes `CreateMachineUseCase.execute()` - STEJNÝ use case jako ruční formulář, se všemi jeho kontrolami (licence, limit, unikátnost kódu). Výsledek (vytvořeno/selhalo + důvod) se zobrazí za řádek.

**Scope rozhodnutí:** plný import (s náhledem) je implementovaný jen pro Machine - nejbohatší a nejvíc specifikovaná entita (zadání bod 33-34). Ostatních 7 sekcí má jen export. Důvod: každá entita má jiná pole a jiné FK vazby (typ nástroje, materiálová skupina, ...), takže import UI by se muselo psát pro každou zvlášť (žádná univerzální komponenta - viz zadání bod o "nevytváření jedné komponenty pro všechno"). Plný rozsah pro všech 9 entit by výrazně prodloužil implementaci bez úměrného přínosu k prokázání vzoru - vzor (preview → per-řádek use case → souhrn) je jednou hotově demonstrovaný a přenositelný. Zdokumentováno jako vědomé scope-cutnutí, ne tichá mezera - viz `docs/step-5/known-limitations.md`.

## Není to jedna atomická DB transakce

Import po řádcích NENÍ obalený jednou IndexedDB transakcí přes všechny řádky - repository na to nemá batch-transakční metodu a přidávat ji jen kvůli importu by bylo overengineering (zadání bod 4). Selhání jednoho řádku (duplicitní kód, licenční limit) nezablokuje ostatní řádky, jen se vypíše ve výsledkovém souhrnu.
