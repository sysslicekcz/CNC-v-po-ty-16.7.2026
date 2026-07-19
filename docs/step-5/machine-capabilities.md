# Krok 5 – schopnosti strojů

Tenhle dokument existuje hlavně kvůli jednomu důležitému rozlišení - viz `docs/adr/machine-capabilities-use-explicit-types.md` pro plné odůvodnění.

## Dvě různé věci, dvě různé entity

**`MachineCapability`** (existující z Kroku 3.5, `domain/entities/machine-capability.ts`) odpovídá na otázku *"umí stroj M provádět typ operace O?"* - `machineId`, `operationTypeId`, `enabled`, `priority?`, `limitations?`. Používá ji `machine-type-classifier.ts` k odvození typu stroje a Krok 4 editor k filtrování kompatibilních strojů pro operaci. Krok 5 tuhle entitu NEPŘEJMENOVAL ani nezměnil tvar - jen jí přidal application use casy (`AssignMachineCapabilityUseCase`/`RemoveMachineCapabilityUseCase`, `application/machines/`) a UI (přiřazení typu operace ke stroji na stránce Stroje).

**`CapabilityType` + `MachineCapabilityValue`** (nové, `domain/entities/capability-type.ts`, `domain/entities/machine-capability-value.ts`) odpovídají na otázku *"jaká je hodnota TECHNICKÉ vlastnosti X na stroji M?"* - např. `MAX_TURNING_DIAMETER = 450 mm`, `LIVE_TOOLING = true`. `CapabilityType` je typovaný registr (`valueType: "boolean"|"number"|"text"|"selection"`, volitelná `unit`/`allowedValues`) s vlastní validací (`validateValue()`), `MachineCapabilityValue` nese samotnou hodnotu na konkrétním stroji.

## Proč ne jedna entita

Sloučení by muselo řešit dva neslučitelné tvary dat (`operationTypeId` reference vs. typovaná hodnota) v jedné třídě - přesně ta předčasná abstrakce, které se zadání (bod 4, "vyhni se overengineeringu") vyhýbá. Oddělené entity, oddělené repozitáře, oddělené use casy - žádná sdílená logika mezi nimi kromě společného vlastníka (`machineId`).

## Vazba na typ operace

`OperationTypeCapabilityRequirement` (nové, `domain/entities/operation-type-capability-requirement.ts`) je třetí, samostatná vazba: *"typ operace O vyžaduje/doporučuje vlastnost X (případně s očekávanou hodnotou)"*. Spravuje se přes `ConfigureOperationTypeCapabilitiesUseCase` na stránce Typy operací. Zadání explicitně omezuje rozsah: **jen správa vazeb, žádný automatický výběr stroje ani plánovací algoritmus** - editor postupu z Kroku 4 vazbu zatím nepoužívá k filtrování, viz `docs/step-5/known-limitations.md` a `docs/step-5/step-6-readiness.md`.

## UI

`/tpv/master-data/capabilities` - registr typů vlastností (CRUD + deaktivace přes update). Hodnoty na konkrétním stroji se přiřazují na stránce Stroje (rozbalený detail řádku).
