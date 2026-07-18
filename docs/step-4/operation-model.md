# Model operace v Kroku 4

## Nová pole na `Operation`

Krok 4 přidal na existující `Operation` (Krok 2/3):

- `externalResourceId?: string` – doplňuje existující `machineId?`, viz `docs/adr/routing-operation-resource-assignment.md`.
- `setupTimeMinutes?: number` – ruční přípravný čas.
- `unitTimeMinutes?: number` – ruční kusový čas.
- `transferBatchSize?: number` – velikost předávací dávky.

## Ruční čas vs. dopočtený čas – NEJSOU totéž pole

`Operation.finalTime` (existující z Kroku 2/3) zůstává BEZE ZMĚNY definice: součet `finalTime` všech `Calculation` na všech `Activity` napříč všemi `Position` operace. Nová ruční pole (`setupTimeMinutes`, `unitTimeMinutes`) tenhle součet NENAHRAZUJÍ ani neovlivňují - jsou to samostatné, souběžné hodnoty, analogicky k existujícímu vzoru `Calculation.manualCorrection` (ruční přepis koexistující s vypočtenou hodnotou, ne mazání jedné druhou).

Editor DTO ukazuje obě hodnoty vedle sebe (`setupTimeMinutes`/`unitTimeMinutes` jako ruční vstup, `calculatedTimeMinutes` = `finalTime` jako read-only dopočet z kalkulací) - technolog vidí obě a sám rozhoduje, kterou hodnotu bere jako závaznou pro danou operaci.

## `Activity` beze změny tvaru

`Activity` NEDOSTALA žádné nové `name`/`timeMinutes` pole, přestože zadání literární interface takové pole zmiňovalo. Zdůvodnění: `Activity.operationTypeId` už jednoznačně určuje typ činnosti (přes `OperationType.nazev` číselník), duplicitní `name` pole by muselo být ručně synchronizované s typem operace a mohlo by se rozejít. Editor DTO (`OperationActivityEditorDto`) odvozuje zobrazovaný název z `operationTypeId → OperationType.nazev` lookupu a `timeMinutes` z `activity.calculation?.finalTime` - žádné duplicitní úložiště pravdy.

## `Position.sortKey` zůstává nepovinné

Legacy migrovaná data (Krok 3) nemusí mít `sortKey` vyplněný. Nový getter `Operation.positionList` řadí položky se `sortKey` podle něj, položky BEZ `sortKey` řadí AŽ ZA ně (stabilně) - nikdy nevyhodí chybu na chybějící `sortKey`. Editor přidává nové veřejné mutátory `Operation.movePosition()`, `Position.setSortKey()`, `Position.rename()` (v Kroku 3 tahle upnutí neměla vlastní veřejné API pro reorder/rename mimo konstruktor).
