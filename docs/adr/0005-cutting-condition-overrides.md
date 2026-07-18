# 0005 – Třívrstvý model řezných podmínek

## Status
Přijato

## Context
Stejný nástroj může mít na různých strojích jiné Vc/feed/ap. Zadání navíc vyžaduje, aby úprava hodnot v konkrétní operaci nikdy nezměnila výchozí data nástroje ani profil pro daný stroj.

## Decision
Priorita při výběru hodnot (`services/cutting-condition-resolver.ts`):
1. `ToolMachineCondition` (profil pro daný stroj, případně zpřesněný `operationTypeId` – materiál a `machiningMode` jsou připravené jako volitelná pole pro budoucí zpřesnění výběru).
2. `Tool.defaultCuttingParameters`.
3. Prázdné hodnoty.

Vybrané hodnoty se vždy kopírují do nové instance `CuttingParameters` (Value Object je immutable) – nikdy se nevrací živý odkaz na hodnoty uložené v `Tool`/`ToolMachineCondition`.

`ToolMachineCondition` navíc modeluje *profil*, ne jedinou unikátní kombinaci (tool, machine) – pro stejnou dvojici může existovat víc profilů s různou prioritou.

## Consequences
- Změna parametrů v `Activity`/`Calculation.inputParameters` nemůže nikdy zpětně ovlivnit master data – zaručeno tím, že `CuttingParameters` je immutable VO a resolver vždy vrací novou instanci.
- Výběr podle materiálu/`machiningMode` není v tomto kroku implementovaný, jen připravený v datovém modelu (pole existují, resolver je zatím nepoužívá).
