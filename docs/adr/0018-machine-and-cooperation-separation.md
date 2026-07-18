# 0018 – ExternalOperationResource (kooperace) je samostatná entita, ne Machine

## Status
Přijato (navazuje na `docs/adr/0010`)

## Context
Krok 3.5 zavádí přípravu na kooperaci (externí zpracování - tepelné zpracování, NDT, černění...). Kooperace nemá stroj, hodinovou sazbu ve smyslu obrábění, kapacitu ani řezné podmínky - je to jiný druh výrobního zdroje než `Machine`. `docs/adr/0010` už dřív zamítlo obecnou abstrakci `Resource` jako předčasnou.

## Decision
Nová entita `ExternalOperationResource` (`src/domain/entities/external-operation-resource.ts`) - vlastní `id`, vlastní `code` (`[tenantId, code]` unikátní), vlastní repository, vlastní licenční funkce `cooperations.view`/`cooperations.manage` (odlišné od `machines.*`). NENÍ to podtyp/varianta `Machine` a NENÍ to obecný `Resource` - `docs/adr/0010`'s rozhodnutí (Machine přímo, ne obecná abstrakce) zůstává v platnosti i po přidání kooperace, protože kooperace a stroj mají natolik odlišný tvar dat (žádná hodinová sazba, žádné capability/cutting conditions), že sdílená abstrakce by dnes jen komplikovala kód bez reálného přínosu.

Tenhle krok neimplementuje kompletní správu kooperací v UI - jen doménu, repository a persistenci (`tpvExternalOperationResources` store).

## Consequences
- `Operation.machineId` zůstává striktně odkaz na `Machine` - přiřazení kooperace k operaci (Krok 4+) bude vyžadovat vlastní pole/mechanismus, ne přetypování `machineId`.
- Licenční kontrola kooperací je nezávislá na licenci strojů - organizace může mít stroje bez kooperací nebo naopak.
