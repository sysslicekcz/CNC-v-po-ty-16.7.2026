# 0013 – 1 stará Position → 1 nová Operation + 1 nová Position, žádné seskupování

## Status
Přijato

## Context
V1 iteraci návrhu migrace seskupovala `partOperationRows` napříč pozicemi podle `opId`, aby z toho vznikla jedna `Operation` na `opId`. To ničilo originální vazbu mezi konkrétním strojem, konkrétním upnutím a sadou výpočtů, které v něm proběhly, a vyžadovalo hádání/řešení konfliktů, když stejný `opId` existoval na pozicích s různým `strojId`.

## Decision
Migrace nikdy neslučuje staré Position podle `opId` ani podle `strojId`. Každá stará `Position` vytvoří přesně jednu novou `Operation` (`Operation.machineId = Position.strojId`) a přesně jednu novou `Position` pod ní. Každý `partOperationRows` záznam patřící té pozici vytvoří jednu `Activity` pod touto novou pozicí.

## Consequences
- Bezztrátové a bezkonfliktní - žádné rozhodování, který stroj/pozice "vyhraje".
- Prakticky vznikne poměr Operation:Position 1:1 (protože stará data neznala koncept "jedna operace, víc upnutí") - to je v pořádku, uživatel může později dvě operace na stejném stroji ručně sloučit v UI (mimo rozsah tohoto kroku).
