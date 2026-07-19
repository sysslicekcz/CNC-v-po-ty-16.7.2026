# Kalkulace v editoru

## Znovupoužitý engine, ne nový

`CalculationPanel` a `CalculateOperationUseCase` volají STEJNÝ `LegacyCalculationEngine`/`OPERATIONS`/`ColumnDef` konfiguraci z `src/lib/operations.ts`, kterou používá legacy appka. Krok 4 nebuduje druhý kalkulační engine ani neduplikuje vzorce.

## Zjednodušení oproti legacy `AddKonturaModal`

`CalculationPanel` NEMÁ automatické řetězení hodnot mezi řádky (`chainFrom` - konec předchozí kontury jako začátek další) ani předvyplnění řezných podmínek z katalogu nástrojů (`fromTool`). Řádky se zadávají ručně. Vědomé zjednodušení kvůli rozsahu Kroku 4 - obě funkce existují v legacy `AddKonturaModal` a jsou kandidát na doplnění v budoucím kroku.

## `CalculateOperationUseCase`

Bere UŽ NAČTENOU živou `RoutingSheet` (ne id k opětovnému načtení) jako součást příkazu, mutuje ji IN-MEMORY přes `routingSheet.recordCalculation(...)` a SÁM NEPERZISTUJE - uložení řeší běžný autosave/uložit tok. Důvod: kdyby use case pracoval nad VLASTNÍ instancí načtenou podle id, vznikl by nesoulad mezi tím, co use case změnil, a tím, co drží editor hook v `useRef` - dvě odlišné instance stejného agregátu.

## Zastaralost kalkulace (`calculationStaleByResourceChange`)

Počítá se v `routing-sheet-editor-mapper.ts` porovnáním `calculation.snapshot.machineId`/`toolId` s AKTUÁLNÍM `Operation.machineId`/`Activity.toolId`. Detekuje JEN zastaralost způsobenou změnou zdroje (stroj/nástroj) - zastaralost způsobenou změnou VSTUPNÍCH PARAMETRŮ (materiál, rozměry, řezné podmínky) se v tomto kroku nesleduje automaticky (vyžadovalo by sledovat editor-session-level stav "vstupy se od výpočtu změnily", což zadání nemandátuje explicitně a je to vědomé zjednodušení rozsahu).

## Licence

`calculations.basic` se vyžaduje pro VŠECHNY kalkulace (write při výpočtu). `calculations.advanced` je připravený, ale dnes nevynutitelný hook - doména zatím nerozlišuje "základní" a "pokročilé" typy kalkulace, takže by šlo o fabrikované rozlišení. Zdokumentováno jako známé omezení, ne tiše implementované.
