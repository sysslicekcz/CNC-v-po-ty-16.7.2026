# 0006 – Calculation nese immutable snapshot

## Status
Přijato

## Context
`Machine.hourlyRate` se v čase mění, `Tool` se může přejmenovat nebo smazat. Bez zamrzlé kopie by starý výpočet po takové změně "přetekl" jinou hodnotou, než se kterou byl skutečně spočítaný – nebezpečné hlavně směrem k budoucí kalkulaci ceny.

## Decision
`Calculation.snapshot` kopíruje popisné/cenové údaje stroje, nástroje a typu operace v okamžiku výpočtu (`CalculationSnapshot`, viz `aggregates/routing-sheet/types.ts`). Snapshot sestavuje Application vrstva (má přístup k `MachineRepository`/`ToolRepository`), doména sama tyhle repozitáře nevolá – tok je: use case načte `Machine`/`Tool`/`OperationType` → sestaví snapshot → zavolá `Activity.recordCalculation(...)` (přes `RoutingSheet`).

Celá `Calculation` je po vytvoření immutable (žádné settery, `Object.freeze` na `inputParameters`/`result`/`snapshot`). Přepočet nebo ruční korekce nikdy nemění existující instanci – `Activity.recordCalculation()` a `applyManualCorrection()` vždy vytvoří a přiřadí novou.

## Consequences
- Historická data zůstávají věrohodná i po pozdější změně master dat.
- `Calculation` dnes drží jen poslední výpočet na `Activity` (ne historii) – API je navržené tak, aby přidání historie (`calculationHistory: Calculation[]`) bylo aditivní změna, protože `recordCalculation()` už teď nikdy nemutuje starou instanci.
- Mírná duplikace dat (kopie názvu/sazby) – akceptovaný kompromis kvůli auditovatelnosti.
