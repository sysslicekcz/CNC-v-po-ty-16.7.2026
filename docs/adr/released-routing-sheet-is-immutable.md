# Vydaný technologický postup je needitovatelný

## Status
Přijato (Krok 4 - Editor technologického postupu)

## Context
Zadání (body 4, 27-29) vyžaduje, aby vydaný ("released") postup nešel po vydání měnit - ani hlavičku, ani operace/upnutí/činnosti, ani ruční časy. Bez vynucení na doménové úrovni by šlo needitovatelnost obejít omylem (chybějící kontrola v jednom z mnoha UI míst) nebo záměrně (přímé volání use casu mimo UI).

## Decision
Needitovatelnost se vynucuje na JEDNOM místě v doméně - `RoutingSheet.assertEditable()` (privátní metoda), volaná na začátku KAŽDÉ mutační metody agregátu (`updateHeader`, `touch`, `addOperation`, `removeOperation`, `reorderOperations`, `addPosition`, `addActivity`, `recordCalculation`, ...):

```ts
private assertEditable(): void {
  if (this.props.stav !== "draft") {
    throw new InvalidStateError(...);
  }
}
```

Editor UI se nemusí (a nesmí) spoléhat na vlastní `readOnly` prop jako na bezpečnostní hranici - `readOnly` v `RoutingSheetEditorPage` je jen UX vrstva (skryje/disable tlačítka, aby uživatel neklikal do zdi). SKUTEČNÁ ochrana je v doméně - i kdyby UI kontrolu obešlo (bug, přímé volání), agregát mutaci odmítne s `InvalidStateError`.

Výjimka: `archive()` a `clearDefault()` NEJSOU gatované přes `assertEditable()` - jde o bookkeeping stavových přechodů (archivace, ztráta příznaku výchozí), ne o obsahovou editaci, a musí fungovat i nad `released`/`archived` postupem (viz `docs/adr/new-revision-instead-of-editing-release.md`).

## Consequences
- Jedno místo pravdy pro "co je needitovatelné" - žádná duplicitní kontrola rozeseta po use casech.
- UI může bezpečně zobrazit read-only režim BEZ obavy, že by ho šlo obejít jinou cestou v appce.
- Read-only snapshot dat (denormalizovaný `ReleasedRoutingSheetSnapshot`) je samostatný koncept, viz `docs/adr/released-routing-sheet-snapshot.md` - `assertEditable()` chrání živý agregát, snapshot je needitovatelný už tím, že pro něj neexistuje žádná update/delete metoda repository.
