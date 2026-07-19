# 0017 – CapacityGroup pro sdílenou fyzickou kapacitu, ne sloučení strojů

## Status
Přijato

## Context
V praxi jeden fyzický stroj může mít v podnikovém systému (ERP - Helios je jen jeden z možných příkladů, stejně tak SAP, K2 apod.) víc různých kódů (např. podle střediska/zakázkového typu) - typicky `300-58140` a `300-58141` označují tentýž stroj. Potřeba: appka musí umět tenhle vztah zachytit, aniž by to poškodilo oddělenou identitu jednotlivých podnikových kódů (viz `docs/adr/0015`).

## Decision
Nová entita `CapacityGroup` (`src/domain/entities/capacity-group.ts`) reprezentuje sdílenou fyzickou kapacitu. Jednotlivé `Machine` záznamy (vlastní `id`, vlastní `code`) se k ní jen připojí přes `Machine.capacityGroupId` (`Machine.assignToCapacityGroup()`) - `Machine` záznamy se NIKDY neslučují ani nemažou kvůli sdílené kapacitě. `CapacityGroup` má vlastní `[tenantId, code]` unikátnost a vlastní repository (`CapacityGroupRepository`).

Tenhle krok neimplementuje žádné plánování/kalendáře/Gantt nad kapacitou - jen model a persistenci (`tpvCapacityGroups` store, IndexedDB schema v2).

## Consequences
- Budoucí plánovací modul (Krok 4+, `planning.*` feature) může sčítat kapacitu napříč podnikovými kódy podle `capacityGroupId`, aniž by ztratil informaci o tom, který konkrétní kód byl použitý na které zakázce.
- Smazání `CapacityGroup` v dnešní implementaci NEODPOJÍ napojené stroje automaticky (`Machine.capacityGroupId` zůstává ukazovat na smazané id) - vědomě zdokumentované jako známé omezení, viz `docs/step-3-5/known-limitations.md`, ne tichá mezera.
