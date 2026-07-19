# Krok 5 – řezné podmínky

`ToolMachineCondition` (`domain/entities/tool-machine-condition.ts`) existovala z dřívějška s bohatším modelem, než zadání vyžadovalo (`machiningMode`, `priority`, `materialId?` - připravené, ale nepoužité pole). Krok 5 ho ZACHOVAL beze změny tvaru a jen doplnil:

- `source?: CuttingConditionSource` (`"manufacturer"|"internal"|"calculated"|"manual"`) - čistě informativní metadata důvěryhodnosti záznamu, nemění vyhodnocení resolveru.
- `note?: string`.
- Tenant-scoped repository (stejná oprava jako u `Tool`/`MachineCapability` - `ToolMachineConditionRepository` teď vyžaduje `tenantId`).
- `materialId?` je konečně propojené na reálnou entitu (`Material`, viz `docs/step-5/materials.md`), ne jen připravené pole bez cíle.

## Není to jediná unikátní kombinace (tool, machine)

Pro stejnou dvojici může existovat víc profilů rozlišených podle `operationTypeId`/`materialId`/`machiningMode` a `priority` - odpovídá dnešnímu `toolRows` (klíč `strojId:opId`) z legacy appky, zobecněno na víc profilů.

## Resolver se specificitou

`domain/services/cutting-condition-resolver.ts` - `resolveCuttingConditions(tool, profiles, request)` (signatura rozšířená z `operationTypeId: string` na `{operationTypeId?, materialId?}`) skóruje kandidátní AKTIVNÍ profily podle specificity (+2 shoda `operationTypeId`, +1 shoda `materialId`) a vybere nejvyšší skóre; při shodě skóre rozhoduje `priority`. Bez žádného shodujícího profilu spadne na `Tool.defaultCuttingParameters`. Neaktivní profily se do výběru nikdy nezapočítají.

## Application use casy

`application/cutting-conditions/`: `create-tool-machine-condition-use-case.ts`, `update-tool-machine-condition-use-case.ts`, `deactivate-tool-machine-condition-use-case.ts` (bez fyzického smazání - jen deaktivace), `list-tool-machine-conditions-use-case.ts`, `resolve-cutting-condition-use-case.ts` (tenký use-case wrapper nad doménovým resolverem, s licenční/tenant kontrolou).

## UI

`/tpv/master-data/cutting-conditions` - seznam (nástroj, stroj, typ operace, materiál, Vc/f/ap, priorita, stav) + formulář. **Není napojeno na kalkulační engine Kroku 4** - viz `docs/step-5/integration-with-calculations.md` a `docs/step-5/known-limitations.md`.
