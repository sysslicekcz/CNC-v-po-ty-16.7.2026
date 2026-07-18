# Editor state management

## Bez Zustand

Projekt NEMÁ `zustand` (ani jinou state-management knihovnu) v `package.json` - potvrzeno auditem (`docs/audits/step-4-audit.md`). Zadání explicitně povoluje použít existující standard appky, pokud tam je - není. Editor proto používá vlastní hook, stejným vzorem jako existující appka řeší lokální stav (`src/lib/use*.ts`).

## `useRoutingSheetEditor()`

Kombinuje `useRef` (mutovatelný, ne-render-trigger stav) a `useState` (render-relevantní stav):

**`useRef`:**
- živý `RoutingSheet` doménový agregát (`routingSheetRef`)
- `Part` (`partRef`)
- předtažené číselníky (`lookupsRef` – `RoutingSheetEditorLookups`)
- `lastLoadedUpdatedAt` (pro optimistickou konkurenční kontrolu)
- `autosaveTimerRef`, `savingRef`

**`useState`** (`RoutingSheetEditorState`):
- `routingSheet` – aktuální `RoutingSheetEditorDto` (immutable snímek)
- `loadStatus`/`loadError`, `saveStatus`/`saveError`, `lastSavedAt`, `dirty`
- `availableMachines`, `availableExternalResources`, `operationTypes`, `tools` – snímky číselníků pro UI (výběr zdroje, nástroje, typu operace)

## `mutate(fn)` – centrální mutační obálka

Každá lokální akce (přidat operaci, přejmenovat upnutí, přiřadit zdroj, ...) prochází přes `mutate(fn)`:

1. ověří, že postup je draft (jinak no-op - read-only chrání i tahle vrstva, ne jen doména),
2. zavolá `fn(routingSheet)` (synchronní doménová mutace),
3. zachytí doménové chyby (nezpůsobí pád UI, jen se zahodí/zaloguje),
4. přepočítá DTO + validaci přes čistý mapper (`recomputeDto`),
5. označí `dirty: true`,
6. naplánuje debounced autosave.

Víc v `docs/adr/editor-holds-live-domain-aggregate.md`.

## Derivovaný stav místo efektu se `setState`

Výchozí vybraná operace (`effectiveSelectedOperationId` v `RoutingSheetEditorPage`) se počítá PŘÍMO při renderu jako derivovaná hodnota (`selectedOperationId ?? routingSheet?.operations[0]?.id ?? null`), NE přes `useEffect`, který by volal `setState`. Původní implementace to dělala přes efekt a ESLint pravidlo `react-hooks/set-state-in-effect` (kaskádové re-rendery) to správně odhalilo - oprava je zdokumentovaným vzorem pro podobné případy v appce.
