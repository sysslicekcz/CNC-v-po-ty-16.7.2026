# Stroje a skupiny kapacity zůstávají oddělené entity

## Status
Přijato (Krok 5 - Správa kmenových dat TPV, potvrzuje a rozšiřuje `docs/adr/0017-shared-capacity-groups.md` z Kroku 3.5)

## Context
Krok 5 dal `CapacityGroup` plnou sadu application use casů a UI - vyvstala otázka, jestli by teď, když je entita "plnohodnotná", nemělo dávat smysl ji sloučit s `Machine` (např. jako `Machine.sharedCapacityMachines: string[]`), aby uživatel neřešil dvě samostatné obrazovky pro věc, která se v UI tváří podobně (obojí je "stroj-like" záznam se jménem a kódem).

## Decision
Zachovat oddělení beze změny. `CapacityGroup` zůstává samostatná entita s vlastním repozitářem, vlastními use casy a vlastní stránkou (`/tpv/master-data/capacity-groups`). `Machine.capacityGroupId` je jediná vazba - víc strojů (různé `id`, různé `code`) může ukazovat na stejnou skupinu, ale `Machine` záznamy se NIKDY neslučují ani neztrácí vlastní identitu.

Důvod zůstává stejný jako v `docs/adr/0017`: `CapacityGroup` reprezentuje SDÍLENOU FYZICKOU kapacitu (jeden fyzický stroj, víc podnikových kódů podle střediska/zakázkového typu), zatímco `Machine` reprezentuje KAŽDÝ jednotlivý podnikový kód se svou vlastní hodinovou sazbou, kategorií a schopnostmi. Sloučení by smazalo rozdíl mezi "kolik fyzických strojů máme" a "kolik podnikových kódů se na ně mapuje" - přesně tu informaci, kterou `CapacityGroup` existuje zachytit.

## Consequences
- Přiřazení/odebrání stroje ke skupině je vlastní, samostatná akce (`AssignMachineToCapacityGroupUseCase`) - odděleně vratná od založení/smazání samotného stroje nebo skupiny.
- Smazání `CapacityGroup` (chráněné usage checkerem) neodstraní připojené stroje - jen zablokuje smazání, dokud je skupina používaná; po deaktivaci `Machine.capacityGroupId` zůstává ukazovat na skupinu (nepřepočítává se automaticky), zdokumentováno jako přijaté omezení.
- Budoucí plánovací modul (mimo rozsah Kroku 5) může sčítat kapacitu napříč podnikovými kódy podle `capacityGroupId`, aniž by ztratil informaci o tom, který konkrétní kód byl použitý na které zakázce.
