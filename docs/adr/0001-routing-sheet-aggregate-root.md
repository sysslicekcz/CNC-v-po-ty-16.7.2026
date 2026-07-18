# 0001 – RoutingSheet jako Aggregate Root

## Status
Přijato

## Context
Technologický postup dílu je strom `RoutingSheet -> Operation -> Position -> Activity -> Calculation`. Bez jasné hranice konzistence by šlo ukládat/mazat jednotlivé úrovně nezávisle, což by rozbilo invarianty jako unikátní `sortKey` mezi sourozenci, zákaz osiřelých potomků nebo atomickou revizi celého postupu.

## Decision
`RoutingSheet` je jediný Aggregate Root pro celý strom. `Operation`, `Position`, `Activity`, `Calculation` nemají vlastní write repository a nemění se jinak než přes metody na `RoutingSheet` (`addOperation`, `addPosition`, `addActivity`, `recordCalculation`, ...). `RoutingSheetRepository.save()` ukládá celý strom atomicky. Vnitřní entity mají veřejné mutační metody (`Operation.addPosition()` apod.) jen proto, aby je `RoutingSheet` mohl volat – Application vrstva smí volat výhradně metody `RoutingSheet`, ne tyto vnitřní metody přímo. Toto je konvence vynucená code review a dokumentací, ne TypeScript privátností (viz "Rizika" níže).

`RoutingSheet` také drží `pullEvents()` (viz zadání bod 15) – minimální kontrakt pro budoucí doménové události, dnes bez dispatcheru.

## Consequences
- Jedna transakční hranice = jednodušší invarianty, jednodušší mentální model.
- Riziko: čtení/zápis celého stromu při každé malé úpravě může být u velkých postupů dražší než cílený update jednoho záznamu – u kusové/malosériové výroby (desítky operací) by to nemělo vadit, ale je to k ověření při napojení produkční perzistence.
- Riziko: bez typového vynucení může Application vrstva teoreticky obejít fasádu a zavolat `operation.addPosition()` přímo – zmírněno jasnou dokumentací a tím, že v tomto kroku žádná Application vrstva ještě neexistuje (žádný precedens ke kopírování).
