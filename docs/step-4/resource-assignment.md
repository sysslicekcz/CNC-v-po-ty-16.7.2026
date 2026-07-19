# Přiřazení zdroje operaci

Podrobné architektonické zdůvodnění: `docs/adr/routing-operation-resource-assignment.md`. Tenhle dokument popisuje, jak se s tím pracuje v editoru.

## `OperationResourceAssignment`

```ts
type OperationResourceAssignment =
  | { type: "machine"; machineId: string }
  | { type: "external"; externalResourceId: string }
  | { type: "unassigned" };
```

Computed z `Operation.machineId`/`Operation.externalResourceId` - nikdy se neukládá přímo. `RoutingSheet.assignResourceToOperation(operationId, assignment)` je JEDINÁ cesta, jak zdroj nastavit atomicky (stroj a kooperace se vzájemně vylučují).

## UI: `ResourceSelector`

Kombinované vyhledávací pole + sekční seznam ("Stroje" / "Kooperace"). Zobrazuje jen AKTIVNÍ stroje/kooperace (pre-filtrované volajícím) - neaktivní zdroje se nedají nově přiřadit, ale JIŽ přiřazený neaktivní zdroj zůstává viditelný (`machineInactive`/`externalResourceInactive` příznak v DTO), aby technolog viděl, že operace potřebuje pozornost, místo aby zdroj tiše zmizel.

Kooperace (`Kooperace` sekce) se v selektoru zobrazují jen s licencí `cooperations.view` (read) - bez ní sekce chybí úplně (ne jen disabled).

## Validace

`operation-missing-resource` (error) – žádný zdroj. `operation-unknown-machine`/`operation-unknown-external-resource` (error) – odkaz na neexistující/nenalezený zdroj (typicky cizí tenant nebo smazaný záznam). `operation-inactive-machine`/`operation-inactive-external-resource` (warning, ne error) – zdroj existuje, ale je neaktivní; nebrání vydání, jen upozorňuje.

## Duplikace operace v editoru

`editor.duplicateOperation()` (lokální mutace, ne persistence use case) kopíruje přiřazený zdroj, ale VĚDOMĚ NEKOPÍRUJE kalkulační snapshot (na rozdíl od `cloneRoutingSheetAsNewDraft` použitého při revizi/duplikaci CELÉHO postupu) - nová operace často vznikne jako základ pro JINÉ vstupy, takže starý spočítaný výsledek by skoro jistě neodpovídal novým podmínkám.
