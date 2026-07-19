# Krok 5 – kooperace

`ExternalOperationResource` (`domain/entities/external-operation-resource.ts`) existovala z Kroku 3.5 (`docs/adr/0018-machine-and-cooperation-separation.md` - kooperace NENÍ `Machine`, samostatná entita bez stroje/hodinové sazby). Krok 5 doplnil zadáním požadovaná pole:

- `supplierId?: string` - vazba na nového `Supplier` (`docs/step-5/suppliers.md`).
- `supportedOperationTypeIds?: string[]` - informativní filtr pro editor (které typy operací kooperace typicky pokrývá) - NENÍ tvrdé omezení, kooperaci lze přiřadit operaci i mimo tenhle seznam.
- `defaultLeadTimeDays?: number`, `defaultCost?: Money`.

Entita přestala být plně immutable ohledně detailů - `updateDetails()` řeší doplňková pole, `rename()`/`changeCode()` beze změny `id`.

## Application use casy

`application/cooperations/`: `create-external-operation-resource-use-case.ts` (existující), nově `update-external-operation-resource-use-case.ts`, `deactivate-...`, `reactivate-...`, `delete-...` (chráněné usage checkerem), `list-external-operation-resources-use-case.ts`. Licence: `cooperations.manage`/`cooperations.view` (existující z Kroku 3.5).

## UI

`/tpv/master-data/cooperations` - seznam kooperací (kód, název, dodavatel, dodací lhůta, stav) + formulář + deaktivace/reaktivace/smazání (chráněné). Sekce dodavatelů je rozbalitelná na stejné stránce (viz `docs/step-5/suppliers.md`) - úzce související data, žádný důvod pro samostatnou navigační položku.
