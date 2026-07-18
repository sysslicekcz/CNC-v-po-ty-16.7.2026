# 0009 – CQRS-lite: read projekce odděleně od write agregátu

## Status
Přijato

## Context
Načítat celý `RoutingSheet` agregát jen kvůli výpisu seznamu operací v UI je zbytečně drahé a zbytečně otevírá cestu k obcházení agregátu (viz 0001).

## Decision
`RoutingSheetQueryService` (`src/application/queries/`) je čistě čtecí rozhraní (`getSummary`, `listByPartId`) vracející ploché DTO (`RoutingSheetSummary`, `RoutingSheetListItem`, `OperationSummary`), ne doménové entity. Žádný command bus, message bus ani event sourcing – jde jen o oddělení zápisu (přes `RoutingSheetRepository`) od čtení pro UI.

## Consequences
- UI seznamy nemusí táhnout celý strom agregátu.
- V tomto kroku je `RoutingSheetQueryService` jen rozhraní bez implementace (žádná perzistence zatím neexistuje) – implementace přijde s IndexedDB/jinou perzistencí v dalším kroku.
