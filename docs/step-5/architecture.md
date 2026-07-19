# Krok 5 – architektura

Kmenová data TPV (stroje, skupiny kapacity, typy operací, kooperace, dodavatelé, nástroje, typy nástrojů, řezné podmínky, materiály) dodržují stejné čtyřvrstvé Clean Architecture dělení jako Kroky 1-4:

```
domain          - entity, hodnotové objekty, repository rozhraní, doménové chyby, čisté služby (resolver)
application     - use casy (jedna třída = jedna akce), DTO tam, kde to má smysl
infrastructure  - IndexedDB repozitáře, mappery, DB schema (tpv-db.ts), usage checker
presentation    - Next.js stránky (/tpv/master-data/*), sdílené UI komponenty, jeden factory hook
```

## Žádný nový architektonický vzor

Krok 5 nezavádí nic, co by v projektu ještě nebylo - viz `docs/audits/step-5-audit.md`, oddíl 5. Konkrétně:

- **Žádný DI kontejner.** `src/presentation/master-data/master-data-dependencies.ts` je jedna factory funkce (`createMasterDataDependencies()`), volaná přes `useMemo` na každé stránce - přesný ekvivalent `routing-sheet-editor-dependencies.ts` z Kroku 4.
- **Žádná formulářová/tabulková knihovna.** Formuláře jsou ruční `useState` + kontrolované vstupy, seznamy jsou ruční `<table>`.
- **Žádná CSV/XLSX knihovna.** Vlastní RFC4180-ish parser/serializer (`csv-utils.ts`), viz `docs/step-5/import-export.md`.

## Ověřená vrstevní pravidla (architektonické testy)

`src/architecture-tests/master-data-layering.test.ts` staticky ověřuje:

1. `domain/` neimportuje nic z `infrastructure/` (žádný přímý kontakt s IndexedDB).
2. `application/` neimportuje nic z `infrastructure/` (use casy dostávají repozitáře jako závislosti konstruktoru, nevytváří si je).
3. Stránky `/tpv/master-data/*` neimportují `IndexedDb*Repository` přímo - jen přes `master-data-dependencies.ts`.
4. `presentation/master-data/*` komponenty (mimo samotný `master-data-dependencies.ts`) taky neimportují repository implementace přímo.
5. `master-data-dependencies.ts` (a `routing-sheet-editor-dependencies.ts` z Kroku 4) jsou JEDINÁ místa v `presentation/`, která smí `new IndexedDb*Repository()`.

## Sdílené UI komponenty

`src/presentation/master-data/components/`:

- `master-data-status-badge.tsx` - jeden vizuál pro aktivní/neaktivní napříč všemi entitami (přijímá čistý `boolean`, funguje pro `MasterDataStatus` i starší `EntityStav`).
- `master-data-nav.tsx` - horní navigace mezi sekcemi.
- `master-data-toolbar.tsx` - hledání + filtr stavu + tlačítko "přidat", sdílené napříč seznamy.
- `confirm-dialog.tsx` - obecný potvrzovací dialog (deaktivace/reaktivace/smazání).
- `export-csv-button.tsx` - jedno tlačítko exportu sdílené napříč sekcemi.
- Entitně specifické komponenty (`machine-form.tsx`, `machine-csv-import-panel.tsx`) zůstávají oddělené - zadání explicitně varuje před jednou univerzální komponentou pro všechny formuláře/seznamy, protože pole se mezi entitami liší.

## Vztah ke Kroku 4

Editor technologického postupu a kalkulační engine (Krok 4) zůstávají nedotčené ve svém vlastním kódu (`domain/aggregates/routing-sheet/*`, `application/routing-sheets/*`) - Krok 5 se dotkl jen míst, která ČTOU kmenová data (repozitáře strojů/nástrojů/typů operací/kooperací), viz `docs/step-5/integration-with-routing-editor.md`.
