# 0022 – Změna licence nikdy nemaže ani nekazí existující data

## Status
Přijato

## Context
Snížení licenčního tieru/limitu (např. `machines.max` z 10 na 5, když tenant už má 8 strojů) je legitimní obchodní situace. Appka nesmí na tuhle změnu zareagovat automatickým mazáním "nadbytečných" záznamů - to by bylo destruktivní a nevratné (viz obecné pravidlo repozitáře: "žádné destruktivní migrace, warovat místo tichého rozhodování").

## Decision
`FeatureAccessService.assertWithinLimit()` a `getLimit()` jsou čistě READ operace nad existujícím stavem licence - nikdy nevolají žádné mazání ani neupravují existující entity. Efekt sníženého limitu je výhradně na PŘÍŠTÍ pokusy o vytvoření nového záznamu (`CreateMachineUseCase.execute()` odmítne založit 9. stroj, když limit klesl na 5, ale existujících 8 strojů zůstává nedotčených, čitelných a použitelných).

Podobně `DevelopmentLicenseProvider` (dekorátor rozšiřující přístup jen ve vývojovém prostředí) a `LocalLicenseProvider` nikdy nemažou ani neupravují uložená data - jen mění, jaká úroveň přístupu se z aktuální licence vypočítá.

## Consequences
- Organizace, která sníží tarif, nepřijde o žádná existující data - jen nemůže zakládat nové nad limitem, dokud limit nezvýší nebo existující záznamy sama neuklidí.
- Budoucí "úklidová" funkce (např. hromadná deaktivace strojů nad limitem) musí být samostatný, explicitní, uživatelem iniciovaný use case - nikdy vedlejší efekt kontroly licence.
