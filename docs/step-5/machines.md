# Krok 5 – stroje

## Rozšíření entity

`Machine` (`src/domain/entities/machine.ts`) měla z Kroku 3.5 `id`, `tenantId`, `code`, `name`, `designation?`, `maxRpm?`, `hourlyRate`, `status`, `note?`, `capacityGroupId?`. Krok 5 přidal:

- `category?: MachineCategory` - volitelná uživatelská klasifikace (soustruh/frézka/bruska/...) pro filtrování v seznamu. NENÍ náhrada odvozeného typu stroje z `machine-type-classifier.ts` (ten zůstává zdrojem pravdy pro shodu s `MachineCapability`) - jen doplňkový štítek.
- `manufacturer?: string`, `model?: string`, `maxPowerKw?: number`.

`updateDetails()` přijímá všechny nové položky, `rename()`/`changeCode()` zůstávají beze změny (nemění `id`).

## Application use casy

`application/machines/`: `create-machine-use-case.ts` (existující), `update-machine-use-case.ts` (rozšířeno o nová pole), `deactivate-machine-use-case.ts` (existující), nově `reactivate-machine-use-case.ts`, `list-machines-use-case.ts`, `delete-machine-use-case.ts` (chráněné `MasterDataUsageChecker`), `assign-machine-capability-use-case.ts`/`remove-machine-capability-use-case.ts` (přiřazení schopnosti provádět typ operace - existující `MachineCapability`, viz `docs/step-5/machine-capabilities.md`).

## UI

`/tpv/master-data/machines` - nejpodrobněji specifikovaná stránka (zadání bod 33-34): seznam s hledáním/filtrem stavu, formulář založení/úpravy, rozbalitelný detail řádku s přiřazením do skupiny kapacity (`assignMachineToCapacityGroupUseCase`) a se správou schopností (přiřazení/odebrání typů operací, které stroj umí). Plný CSV import (s náhledem před potvrzením) i export - jediná entita s obousměrným CSV workflow v tomto kroku, viz `docs/step-5/import-export.md`.

## Vztah k CapacityGroup

`Machine.capacityGroupId` je nepovinná vazba na `CapacityGroup` - víc strojů (různé `code`) může sdílet stejnou fyzickou kapacitu. Přiřazení/odebrání jde JEN přes `AssignMachineToCapacityGroupUseCase`, nikdy se neslučují `Machine` záznamy samotné (`docs/adr/0017-shared-capacity-groups.md`, beze změny v Kroku 5).
