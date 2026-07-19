# Licencování v editoru technologického postupu

Znovupoužívá kompletně infrastrukturu z Kroku 3.5 (`FeatureAccessService`, `FeatureGate`, `DevelopmentLicenseProvider`) - žádné nové licenční mechanismy, jen nové `FeatureCode` hodnoty se v UI poprvé skutečně používají.

## Použité feature kódy

| Kód | Kde se vynucuje |
|---|---|
| `routing.view` (read) | Vstupní brána editoru (`FeatureGate` obaluje celou stránku), `ListRoutingSheetsUseCase`, `GetRoutingSheetEditorUseCase`. |
| `routing.edit` (write) | `CreateRoutingSheetUseCase`, `SaveRoutingSheetDraftUseCase`, `CreateRoutingSheetRevisionUseCase`, `DuplicateRoutingSheetUseCase`. |
| `routing.release` (write) | `ReleaseRoutingSheetUseCase`. |
| `calculations.basic` (write) | `CalculateOperationUseCase`, tlačítko "Vypočítat" v `CalculationPanel` (obalené `FeatureGate`). |
| `cooperations.view` (read) | Zobrazení sekce "Kooperace" v `ResourceSelector`. |

## Rozšíření výchozí lokální licence

`seed-default-tenant.ts` (Krok 3.5) PŮVODNĚ neobsahovala `routing.release` ani `cooperations.view` - bez nich by čerstvá instalace appky nikdy nemohla vydat postup ani vybrat kooperaci jako zdroj operace, což by přímo odporovalo cíli Kroku 4 ("použitelný editor"). Krok 4 tahle dvě práva doplnil do výchozí licence (odůvodnění v komentáři přímo v `seed-default-tenant.ts`).

## Read-only kvůli licenci vs. read-only kvůli vydání

`RoutingSheetEditorPage` rozlišuje DVA různé důvody pro read-only režim (zadání bod 29):

```ts
readOnly = isReleasedOrArchived || !canEdit
readOnlyReason =
  isReleasedOrArchived ? "Tato revize je vydaná a nelze ji přímo upravovat."
  : !canEdit ? "Vaše licence umožňuje pouze prohlížení technologických postupů."
  : null
```

UI zobrazuje odpovídající vysvětlující banner - uživatel vždycky ví, PROČ nemůže editovat, ne jen ŽE nemůže.

## Bezpečnostní hranice

Licenční kontrola je vždy v `application` vrstvě (use casy), ne jen v UI - `FeatureGate`/`disabled` tlačítka jsou UX vrstva navrch, nikdy jediná ochrana (stejný princip jako v Kroku 3.5, `docs/adr/0021`).
