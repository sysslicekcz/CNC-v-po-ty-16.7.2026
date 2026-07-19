# Krok 5 – materiály

## Rozhodnutí implementovat (viz `docs/audits/step-5-audit.md`, oddíl 7)

`Part.material?: string` (volný text) byl jediné dřívější použití materiálu - kalkulační engine na materiálu vůbec nezávisí (žádný lookup, žádné vzorce podle materiálu v `src/lib/operations.ts`). Jediné funkční využití nové entity je přes `ToolMachineCondition.materialId` (dřív připravené, nepoužité pole) a `materialId` filtr v `resolveCuttingConditions`. Rozhodnuto implementovat **minimální** model přesně podle zadání bodu 22 - žádná rozsáhlá databáze materiálových norem.

`Part.material` (volný text) se NEPŘEVÁDÍ na FK - zůstává nezávislé pole. Fuzzy migrace textu na entitu by riskovala špatné párování a je mimo rozsah tohoto kroku.

## Entity

`MaterialGroup` (`domain/entities/material-group.ts`, nové): `id`, `tenantId`, `code`, `name`, `status`. Např. "konstrukční ocel", "nerez", "hliník".

`Material` (`domain/entities/material.ts`, nové): `id`, `tenantId`, `code`, `name`, `materialGroupId` (povinná vazba), `standard?` (norma), `designation?`, `densityKgPerM3?`, `hardness?`, `status`, `note?`. Validuje nezápornost `densityKgPerM3`/`hardness` na úrovni entity (`create()` i `updateDetails()`), ne jen v use casu.

## Application use casy

`application/materials/`: `create-material-group-use-case.ts`, `deactivate-material-group-use-case.ts`, `list-material-groups-use-case.ts` (bez update - skupina nese jen kód/název, měnit se dá jen přes přejmenování, které v tomto kroku nemá samostatný use case, viz known-limitations), `create-material-use-case.ts`, `update-material-use-case.ts`, `deactivate-material-use-case.ts`, `list-materials-use-case.ts`.

Deaktivace materiálové skupiny NESMAŽE materiály, které do ní patří (ověřeno testem, `material-use-cases.test.ts`) - `Material.materialGroupId` zůstává platné, jen se skupina přestane nabízet pro NOVÉ přiřazení.

## UI

`/tpv/master-data/materials` - materiálové skupiny (jednoduchý inline seznam + rychlé přidání) a materiály (plný seznam + formulář) na jedné stránce.
