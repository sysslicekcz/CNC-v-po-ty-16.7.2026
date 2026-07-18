# Validace technologického postupu

## Jedno místo pravdy

`ValidateRoutingSheetUseCase` je jediná třída, která doménová pravidla zná - čistá, synchronní, bez side-effectů. Používá se DVAKRÁT se stejným vstupem, ale jiným vyhodnocením výstupu:

- **Draft (informativně):** `GetRoutingSheetEditorUseCase` i editor hook po každé lokální mutaci spustí validaci a zobrazí VŠECHNY nálezy (error/warning/info) - nic neblokuje editaci.
- **Release (blokující):** `ReleaseRoutingSheetUseCase` spustí STEJNOU validaci, ale odmítne vydání, pokud je mezi nálezy aspoň jeden `severity === "error"` (`RoutingSheetValidationError`).

Validace NENÍ implementovaná duplicitně v React komponentách - UI jen ZOBRAZUJE nálezy, které dodala tahle třída.

## Pravidla

| Kód | Závažnost | Popis |
|---|---|---|
| `routing-sheet-empty` | error | Postup nemá žádnou operaci. |
| `operations-ambiguous-order` | error | Dvě operace se stejným číslem (defenzivní - agregát to normálně nedovolí vzniknout). |
| `operation-missing-resource` | error | Operace nemá přiřazený stroj ani kooperaci. |
| `operation-unknown-machine` / `operation-unknown-external-resource` | error | Odkaz na neexistující zdroj. |
| `operation-inactive-machine` / `operation-inactive-external-resource` | warning | Zdroj existuje, ale je neaktivní. |
| `operation-missing-time` | warning | Operace má zdroj, ale nulový čas (žádný ruční čas, `finalTime === 0`). |
| `positions-ambiguous-order` | error | Dvě upnutí se stejným `sortKey`. |
| `activity-unknown-operation-type` | error | Činnost odkazuje na neznámý typ operace. |

## UI

`RoutingValidationPanel` (pravý panel) zobrazuje nálezy barevně podle závažnosti, kliknutí naviguje na příslušnou operaci (`onNavigate`). `ReleaseRoutingSheetDialog` zobrazuje počty upozornění/chyb a tlačítko "Vydat" je disabled při `errorCount > 0` - ALE `ReleaseRoutingSheetUseCase` validuje ZNOVU nezávisle na UI stavu tlačítka (UI kontrola není bezpečnostní hranice, stejný princip jako `docs/adr/0021` z Kroku 3.5).
