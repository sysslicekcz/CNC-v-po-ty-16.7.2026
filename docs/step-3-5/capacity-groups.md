# Skupiny sdílené kapacity (CapacityGroup)

Viz `docs/adr/0017-shared-capacity-groups.md` pro rozhodnutí.

## Problém, který řeší

Jeden fyzický stroj může mít v Heliosu víc různých kódů (typicky podle střediska). Appka potřebuje umět zachytit "tohle jsou různé Helios kódy téhož stroje", aniž by ztratila možnost odlišit je (různé zakázky/kalkulace mohly historicky použít různý kód).

## Model

`CapacityGroup` (`src/domain/entities/capacity-group.ts`) - vlastní `id`, `tenantId`, `code` (`CapacityGroupCode`, unikátní v rámci tenanta), `name`, `status`, volitelná `note`. Jednotlivé `Machine` záznamy se připojí přes `Machine.capacityGroupId` (nastavuje se přes `Machine.assignToCapacityGroup(capacityGroupId | undefined)`).

**Machine záznamy se nikdy neslučují ani nemažou** kvůli sdílené kapacitě - `300-58140` a `300-58141` zůstávají dva samostatné `Machine` s vlastním `id`/`code`/historií kalkulací, jen oba ukazují na stejnou `CapacityGroup`.

## Use casy

- `CreateCapacityGroupUseCase` (`src/application/capacity-groups/create-capacity-group-use-case.ts`) - vyžaduje feature `machines.capacity_groups` s `write` přístupem, hlídá unikátnost kódu v rámci tenanta.
- `AssignMachineToCapacityGroupUseCase` (`src/application/machines/assign-machine-to-capacity-group-use-case.ts`) - přiřadí/odebere stroj ze skupiny, ověří existenci obou entit v rámci stejného tenanta.

## Co tenhle krok NEDĚLÁ

Žádné plánování, kalendáře ani Gantt nad kapacitou - jen model a persistenci (`tpvCapacityGroups` store). Plánovací modul je budoucí `planning.*` feature (Krok 4+).

## Známé omezení

Smazání `CapacityGroup` (`CapacityGroupRepository.delete()`) NEODPOJÍ automaticky napojené stroje - `Machine.capacityGroupId` zůstane ukazovat na smazané id. Otestováno a zdokumentováno v `capacity-group-repository.test.ts` a `docs/step-3-5/known-limitations.md`, ne tichá mezera.
