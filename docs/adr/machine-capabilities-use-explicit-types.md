# Technické vlastnosti strojů mají explicitní typový registr, oddělený od "umí typ operace"

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
Zadání Kroku 5 popisuje "capability" strojů jako technickou vlastnost s hodnotou (max. průměr soustružení, počet os, poháněné nástroje). Projekt už ale měl entitu `MachineCapability` (Krok 3.5) s úplně jiným významem - "stroj M umí provádět typ operace O" (`machineId`, `operationTypeId`, `enabled`, `priority`, `limitations`). Používá ji `machine-type-classifier.ts` k odvození typu stroje a je předpokladem pro budoucí filtrování v editoru Kroku 4. Přejmenování nebo rozšíření existující třídy tak, aby pokryla OBOJÍ, by smísilo dva neslučitelné tvary dat (reference na typ operace vs. typovaná technická hodnota) do jedné entity.

## Decision
Existující `MachineCapability` se NEMĚNÍ - zůstává "umí typ operace O", dostává jen nové application use casy (`AssignMachineCapabilityUseCase`/`RemoveMachineCapabilityUseCase`) a UI. Pro technické vlastnosti se zavádí NOVÝ, samostatný pár entit:

- `CapabilityType` (`domain/entities/capability-type.ts`) - typovaný registr (`valueType: "boolean"|"number"|"text"|"selection"`, volitelná `unit`/`allowedValues`), s vlastní validací hodnoty (`validateValue()`).
- `MachineCapabilityValue` (`domain/entities/machine-capability-value.ts`) - hodnota jedné `CapabilityType` na konkrétním stroji.

Volitelná vazba `OperationTypeCapabilityRequirement` propojuje typ operace s `CapabilityType` (vyžadováno/doporučeno, volitelná očekávaná hodnota) - jen správa vazeb, žádný automatický výběr stroje.

## Consequences
- V doméně existují DVĚ podobně pojmenované, ale sémanticky odlišné věci (`MachineCapability` vs. `MachineCapabilityValue`) - riziko záměny při čtení kódu, zmírněné rozsáhlými komentáři v obou entitách a v tomhle ADR.
- Žádná sdílená logika/repository mezi `MachineCapability` a `MachineCapabilityValue` - dva nezávislé, jednoduché agregáty místo jedné komplikované třídy s podmíněnými poli.
- `OperationTypeCapabilityRequirement` je připravený podklad pro budoucí filtrování strojů v editoru (Krok 6+), ale v tomhle kroku se nepoužívá k žádnému automatickému rozhodování - viz `docs/step-5/step-6-readiness.md`.
