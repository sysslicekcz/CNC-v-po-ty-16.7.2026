# Krok 4 – architektura editoru technologického postupu

## Vrstvy

Editor drží stejnou Clean Architecture jako předchozí kroky, s novou vrstvou `presentation` pro UI-adjacent kód (hooky, mappery chyb, React komponenty), oddělenou od `application` (use casy, DTO, doménová validace):

```
domain          RoutingSheet, Operation, Position, Activity, Calculation (beze změny tvaru z UI potřeb)
application     use casy (Create/Get/Save/Release/CreateRevision/Duplicate/Calculate/List/GetReleased),
                DTO (RoutingSheetEditorDto a vnořené), mapper (routing-sheet-editor-mapper.ts),
                validace (ValidateRoutingSheetUseCase)
infrastructure  IndexedDB repozitáře (RoutingSheet, ReleasedRoutingSheetSnapshot), migrace
presentation    useRoutingSheetEditor hook, React komponenty, dependency factory, chybové zprávy
app/tpv         Next.js App Router stránky (tenké obálky nad presentation komponentami)
```

## Route struktura

```
/tpv/routing-sheets            seznam (ListRoutingSheetsUseCase)
/tpv/routing-sheets/new        výběr dílu + založení (CreateRoutingSheetUseCase)
/tpv/routing-sheets/[id]       editor (RoutingSheetEditorPage)
```

Precedens pro `/tpv/...` route strukturu je existující `/dev/tpv-migration` (jediná dosavadní skutečná App Router stránka - zbytek appky používá interní `View` union stav v `CncApp.tsx`). Nové routy jsou plnohodnotné Next.js stránky, ne rozšíření legacy `View` unionu - legacy appka (`src/app/page.tsx`, `src/components`, `src/lib`) zůstává nedotčená (strangler pattern, viz Krok 1).

`[id]` route je Client Component čtoucí `id` přes `useParams()` a explicitně ho dekóduje (`decodeURIComponent`) - RoutingSheet ID obsahuje `:` (např. `tpv-routing-sheet:<uuid>` u migrovaných postupů), který se v URL segmentu objevuje percent-encoded a tahle verze Next.js ho automaticky nedekóduje (ověřeno ručním testem v prohlížeči, viz `docs/step-4/known-limitations.md`).

## Závislosti (bez DI kontejneru)

Appka nemá DI kontejner (potvrzeno auditem, `docs/audits/step-4-audit.md`). `createRoutingSheetEditorDependencies()` (`routing-sheet-editor-dependencies.ts`) je jediná factory funkce, která ručně sestaví všechny repozitáře a use casy nad stejnými konkrétními instancemi - volá se JEDNOU přes `useMemo` v každé stránce/hooku, ne opakovaně při každém renderu.

## Znovupoužití existující infrastruktury

- Licencování (Krok 3.5): `FeatureAccessService`, `FeatureGate`, `DevelopmentLicenseProvider` - beze změny, jen nové `FeatureCode` hodnoty (`routing.*`, `calculations.*`) se skutečně používají v UI poprvé.
- Kalkulační engine (Krok 1-2): `LegacyCalculationEngine`, `OPERATIONS`/`ColumnDef` z `src/lib/operations.ts` - beze změny, `CalculateOperationUseCase` je tenká obálka volající stejný engine.
- Tisk vydaného postupu NENÍ v tomto kroku implementovaný - existující `.print-area`/`window.print()` vzor z legacy appky je kandidát na znovupoužití, ale žádná tisková obrazovka pro `ReleasedRoutingSheetSnapshot` zatím neexistuje (viz `docs/step-4/known-limitations.md`, bod o chybějícím tiskovém výstupu).
