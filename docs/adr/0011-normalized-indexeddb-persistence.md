# 0011 – Normalizovaná IndexedDB perzistence v samostatné databázi

## Status
Přijato

## Context
`RoutingSheet` je doménový Aggregate Root, ale nemusí být uložen jako jeden obrovský JSON dokument. Zároveň potřebujeme, aby stará appka (`cnc-casovac`, `src/lib/db.ts`) zůstala zcela nedotčená.

## Decision
Nová TPV data žijí v samostatné IndexedDB databázi `cnc-tpv` (`src/infrastructure/persistence/indexeddb/tpv-db.ts`), ne jako další verze staré `cnc-casovac`. Uvnitř je perzistence normalizovaná - `RoutingSheetRecord`, `OperationRecord`, `PositionRecord`, `ActivityRecord`, `CalculationRecord` jsou oddělené stores propojené perzistenčními FK (`routingSheetId`, `operationId`, `positionId`, `activityId`), které doména nemá (vztah tam dává vnoření stromu, ne FK - viz Krok 2). `IndexedDbRoutingSheetRepository.findById()`/`save()` sestaví/rozloží celý agregát v jedné transakci napříč pěti stores.

## Consequences
- Nulové riziko kolize se starou databází/verzí - `src/lib/db.ts` se vůbec nemění.
- `save()` maže celý starý podstrom konkrétní RoutingSheet a zapisuje nový (jednodušší než přesný diff, stejně korektní, nikdy se nedotkne jiné RoutingSheet).
- Mappery (`Record <-> Domain`) jsou explicitní a striktní - neplatná data vždy vyhodí chybu, nikdy tichý fallback.
