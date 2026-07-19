# Krok 5 – dodavatelé

`Supplier` (`domain/entities/supplier.ts`, nové) - minimální model: `id`, `tenantId`, `code?`, `name`, `registrationNumber?` (IČO), `email?`, `phone?`, `status: MasterDataStatus`, `note?`. Existuje jen proto, aby `ExternalOperationResource.supplierId` měla na co ukazovat - **žádný nákupní/skladový modul**, mimo rozsah zadání.

## Proč ne `Customer`

Projekt už má entitu `Customer` z Kroku 1 (komu appka fakturuje/pro koho vyrábí). `Supplier` je záměrně SAMOSTATNÁ entita, i když v realitě jedna firma může být obojí - zadání to explicitně vyžaduje, protože obě mají jiný účel a časem by mohly potřebovat nezávisle rozdílná pole (dodavatel typicky nepotřebuje fakturační údaje objednávky, zákazník nepotřebuje dodací lhůtu kooperace). Sloučení by bylo předčasná abstrakce podle stejného principu jako `docs/adr/0010` (žádný obecný `Resource`).

## Application use casy

`application/suppliers/`: `create-supplier-use-case.ts`, `update-supplier-use-case.ts`, `deactivate-supplier-use-case.ts`, `list-suppliers-use-case.ts`. Licence: pod `cooperations.manage`/`cooperations.view` - dodavatel je podpůrný číselník pro kooperace, ne vlastní licencovaný modul (zadání bod 16).

Poznámka: `ReactivateSupplierUseCase` NEBYL implementován (jen `DeactivateSupplierUseCase`) - zdokumentováno v `docs/step-5/known-limitations.md`, drobná mezera oproti symetrii ostatních entit, ne blokující.

## UI

Rozbalitelná sekce na stránce `/tpv/master-data/cooperations` (viz `docs/step-5/cooperations.md`) - seznam + formulář, žádná vlastní navigační položka.
