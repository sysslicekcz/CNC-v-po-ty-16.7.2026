# Kmenová data se deaktivují, ne mažou - fyzické smazání je chráněná výjimka

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
Kmenová data (stroje, nástroje, typy operací, kooperace, ...) jsou průběžně odkazovaná z technologických postupů a jejich kalkulačních snapshotů (Krok 4). Fyzické smazání použitého záznamu by rozbilo historické zobrazení ("jaký stroj byl na téhle operaci?") nebo by muselo v cizích agregátech přepisovat odkazy na "smazáno" - obojí je nebezpečnější a složitější, než ho jednoduše zakázat. Zároveň appka potřebuje i cestu ven pro OMYLEM založené, ještě nepoužité záznamy (překlep v kódu, duplicitní založení).

## Decision
Každá kmenová entita má `setStatus`/`setStav` a odpovídající `Deactivate*UseCase` (případně `Reactivate*UseCase`) - tohle je VŽDY dostupná, nedestruktivní cesta. Fyzické smazání (`Delete*UseCase`) existuje jen pro entity, kde je to zadáním explicitně užitečné (`Machine`, `CapacityGroup`, `ExternalOperationResource`), a je vždy chráněné sdíleným portem `MasterDataUsageChecker` (`domain/services/master-data-usage-checker.ts`) - pokud je záznam používaný, smazání vyhodí `MasterDataInUseError` (`domain/errors/master-data-errors.ts`) a doporučí deaktivaci.

Nové přiřazení NEAKTIVNÍHO záznamu je zakázané (`MasterDataInactiveError`) - existující historické přiřazení zůstává nedotčené, jen se blokuje vznik NOVÉ vazby na neaktivní kmenový záznam.

## Consequences
- Žádné kmenové rozhodnutí (deaktivace/smazání) nemůže tiše poškodit historická data - buď je operace bezpečná vždy (deaktivace), nebo je explicitně ověřená před provedením (smazání + usage checker).
- `MasterDataUsageChecker` implementace je pro některé entity záměrně konzervativní/globální (viz `docs/step-5/deactivation-and-history.md`) - cena za bezpečnost je občas zbytečné odmítnutí smazání, které by ve skutečnosti bylo v pořádku, nikdy naopak.
- Entity bez `Delete*UseCase` (`OperationType`, `ToolType`, `Tool`, `ToolMachineCondition`, `Material`, `MaterialGroup`, `Supplier`, `CapabilityType`) nemají v appce ŽÁDNOU cestu k fyzickému odstranění omylem založeného záznamu - jen deaktivace. Přijato jako přiměřené vzhledem k tomu, že deaktivovaný záznam nepřekáží (nenabízí se pro nové přiřazení) a appka dnes nemá scénář, kde by "zmizet úplně" bylo nutné.
