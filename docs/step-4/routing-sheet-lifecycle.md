# Životní cyklus technologického postupu

## Stavy

`RoutingSheetStav = "draft" | "released" | "archived"` (`"archived"` odpovídá `"obsolete"` ze zadání - název ponechán kvůli konzistenci s existující doménou z Kroku 2/3, viz `docs/audits/step-4-audit.md`).

```
                 CreateRoutingSheetUseCase
                          │
                          ▼
                      ┌─────────┐
                      │  draft  │◄────────────┐
                      └────┬────┘             │
                           │ release()        │ CreateRoutingSheetRevisionUseCase
                           ▼                  │ (nová revize)
                     ┌───────────┐            │
                     │ released  │────────────┘
                     └─────┬─────┘
                           │ archive() (při vzniku nové revize)
                           ▼
                     ┌───────────┐
                     │ archived  │
                     └───────────┘
```

- **draft** – editovatelný (`assertEditable()` prochází). Nejvýš jeden draft na díl současně.
- **released** – needitovatelný. Vzniká z draftu (`RoutingSheet.release()`), vytváří `ReleasedRoutingSheetSnapshot` (viz `docs/step-4/release-snapshot.md`).
- **archived** – needitovatelný, historická revize nahrazená novější. Vzniká ze `released` (nikdy přímo z `draft`, mimo `DuplicateRoutingSheetUseCase`, který archivaci vůbec nepoužívá).

## Revize

`verze: string` (existující pole z Kroku 2) se používá jako číslo revize; `revisionNumber` getter ho parsuje na `number`. Nová revize vzniká VÝHRADNĚ z `released` postupu (`CreateRoutingSheetRevisionUseCase`) - nejde vytvořit revizi z draftu ani z archived. Podrobnosti a zdůvodnění pořadí (archivace hned, ne až při vydání nové revize) viz `docs/adr/new-revision-instead-of-editing-release.md`.

## Výchozí revize (`isDefault`)

Každý díl má nejvýš jednu `RoutingSheet` s `isDefault: true` - tu, kterou by měl technolog/výroba považovat za aktuální. `CreateRoutingSheetUseCase` ji nastaví jen pro první revizi (`revision === 1`). `CreateRoutingSheetRevisionUseCase` příznak PŘENÁŠÍ na novou revizi a explicitně ho ZRUŠÍ na zdroji (`source.clearDefault()`) - bez toho by po několika revizích mělo `isDefault: true` víc záznamů současně (opravený bug, viz `docs/step-4/known-limitations.md` a testy v `routing-sheet-use-cases.test.ts`). `DuplicateRoutingSheetUseCase` naopak `isDefault` NIKDY nekopíruje - duplikát vždy vzniká s `isDefault: false`, protože jde o "začni od podobného postupu", ne o formální nahrazení zdroje.

## Duplikace vs. revize

Dvě odlišné operace se společným základem (`cloneRoutingSheetAsNewDraft`):

| | `CreateRoutingSheetRevisionUseCase` | `DuplicateRoutingSheetUseCase` |
|---|---|---|
| zdroj musí být | `released` | libovolný stav |
| zdroj se archivuje | ano | ne |
| `isDefault` nové kopie | `true` | `false` |
| účel | formální nová verze nahrazující starou | pracovní kopie/inspirace |

## Kdo smí co

Všechny přechody vyžadují licenci `routing.edit` (write) na založení/úpravu, `routing.release` (write) na vydání. Bez licence use case vyhodí `FeatureNotLicensedError` PŘED jakoukoliv mutací.
