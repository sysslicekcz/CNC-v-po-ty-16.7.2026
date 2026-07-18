# Kooperace (ExternalOperationResource)

Viz `docs/adr/0018-machine-and-cooperation-separation.md` pro rozhodnutí.

## Co je kooperace

Externí zpracování prováděné mimo appku obsluhovaný stroj - tepelné zpracování, NDT (nedestruktivní zkoušení), černění, kalení a podobně, typicky prováděné dodavatelem. Kooperace nemá stroj, hodinovou sazbu ve smyslu obrábění, kapacitu, řezné podmínky ani capability.

## Model

`ExternalOperationResource` (`src/domain/entities/external-operation-resource.ts`) - vlastní `id`, `tenantId`, `code` (`ExternalResourceCode`, unikátní v rámci tenanta), `name`, volitelný `supplierId`, `status`, volitelná `note`. Vlastní repository (`ExternalOperationResourceRepository`) i vlastní IndexedDB store (`tpvExternalOperationResources`).

## Proč to NENÍ Machine ani obecný Resource

`docs/adr/0010` už dřív zamítlo obecnou abstrakci `Resource` jako předčasnou (appka tehdy měla jen stroje). Krok 3.5 tohle rozhodnutí potvrzuje i po přidání kooperace - kooperace má natolik odlišný tvar dat, že sdílená abstrakce se strojem by dnes jen komplikovala kód. `Operation.machineId` zůstává striktně odkaz na `Machine`.

## Licencování

Vlastní funkce `cooperations.view`/`cooperations.manage`, nezávislé na `machines.*` - organizace může mít licencované stroje bez kooperací nebo naopak.

## Use casy

`CreateExternalOperationResourceUseCase` (`src/application/cooperations/create-external-operation-resource-use-case.ts`) - vyžaduje `cooperations.manage` s `write` přístupem, hlídá unikátnost kódu v rámci tenanta.

## Co tenhle krok NEDĚLÁ

Žádnou kompletní správu kooperací v UI, žádné přiřazení kooperace k `Operation`/`Activity` (bude vyžadovat vlastní pole/mechanismus v Kroku 4+, ne přetypování `Operation.machineId`) - jen doména, repository a persistence.
