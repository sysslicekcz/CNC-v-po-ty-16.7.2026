# Krok 5 – licencování kmenových dat

## Nové feature kódy

`domain/licensing/feature-code.ts` už měl z Kroku 3.5 `machines.view/manage`, `machines.capacity_groups`, `tools.view/manage`, `cooperations.view/manage`. Krok 5 doplnil:

- `operation_types.view` / `operation_types.manage`
- `cutting_conditions.view` / `cutting_conditions.manage`
- `materials.view` / `materials.manage`

`Supplier`/`CapabilityType`/`MachineCapabilityValue`/`OperationTypeCapabilityRequirement` NEDOSTALY vlastní feature kódy - patří pod existující `cooperations.manage`/`machines.manage` (podpůrné číselníky, ne vlastní licencované moduly, viz `docs/step-5/suppliers.md` a `docs/step-5/machine-capabilities.md`).

## Nové licenční limity

`domain/licensing/license-limit-code.ts` doplněno o `tools.max`, `capacityGroups.max`, `externalResources.max`, `operationTypes.max` (vedle existujícího `machines.max`). Každý `Create*UseCase` volá `assertWithinLimit(limitCode, currentCount + 1)` PŘED zápisem - stejný vzor jako `CreateMachineUseCase` z Kroku 3.5.

## Snížení limitu nikdy nemaže data

Žádný kód v projektu nereaguje na změnu licenčního limitu mazáním/deaktivací existujících záznamů - limit se vynucuje jen při ZALOŽENÍ nového záznamu (`assertWithinLimit` volané výhradně v `Create*UseCase`, nikde jinde). Pokud administrátor sníží limit pod aktuální počet záznamů, appka nic neudělá - existující záznamy zůstávají plně funkční, jen nejde založit další, dokud se počet nesníží deaktivací/smazáním (`docs/adr/0022-license-does-not-delete-data.md`, platí beze změny i pro nové Krok 5 limity).

## Výchozí licence

`infrastructure/licensing/seed-default-tenant.ts` - výchozí seedovaná licence tenanta rozšířena o všech 6 nových feature kódů na `"full"` přístup. Odůvodnění stejné jako u Kroku 4: čerstvá instalace appky musí umět použít VŠECHNO, co byl tenhle krok - jinak by byla nová funkcionalita neviditelná hned po instalaci.

## UI hlídání

Každá stránka `/tpv/master-data/*` volá `useFeatureAccessSnapshot` jednou při připojení a používá `FeatureGate`/`satisfiesAccess` pro čtení i řízení viditelnosti akčních tlačítek - stejný vzor jako Krok 4. Skrytí tlačítka v UI NIKDY není jediná ochrana - odpovídající use case nezávisle volá `featureAccessService.require(...)`.
