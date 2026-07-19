# Krok 5 – typy operací

## Z globálního seedovaného číselníku na tenant-scoped kmenová data

`OperationType` (`domain/entities/operation-type.ts`) existovala od dřívějška jako čistě systémový, seedovaný číselník - žádné `tenantId`, nikdy netvořená uživatelem. Krok 5 ji poprvé zpřístupnil jako skutečně editovatelná kmenová data:

- Přidáno povinné `tenantId: string`.
- Přidáno `resourceRequirement: "machine"|"external"|"either"|"none"` (jaký druh zdroje operace tohoto typu potřebuje).
- Přidáno `requiresSetupTime: boolean`, `requiresUnitTime: boolean`.
- Entita přestala být immutable - přidány `rename()`, `changeCode()`, `updateDetails()`, `setStav()`.

## Migrace (DB verze 4 → 5)

Protože existující řádky v `tpvOperationTypes` (a stejně tak `tpvToolTypes`) žádné `tenantId` nemají, `upgrade()` (`infrastructure/persistence/indexeddb/tpv-db.ts`) v bloku `if (oldVersion < 5)` **backfilluje** existující záznamy přes `IDBObjectStore.openCursor()` + `cursor.update()` (jediný BACKFILLUJÍCÍ upgrade v projektu - všechny ostatní verze byly čistě aditivní, jen nové store/indexy). Nové řádky dostávají `DEFAULT_TENANT_ID`. Otestováno v `tpv-db-upgrade.test.ts` proti REÁLNÉ migrační logice (ne zjednodušené simulaci) - viz poznámka o testovací technice v `docs/step-5/known-limitations.md`.

Dopad na Krok 4: všechna volání `operationTypeRepository.findAll()` (bez tenanta) byla přepsána na `list(tenantId)` - `get-routing-sheet-editor-use-case.ts`, `release-routing-sheet-use-case.ts`, `calculate-operation-use-case.ts`, `use-routing-sheet-editor.ts`, `routing-sheet-editor-dependencies.ts`.

## Application use casy

`application/operation-types/`: `create-operation-type-use-case.ts`, `update-operation-type-use-case.ts`, `deactivate-operation-type-use-case.ts`, `reactivate-operation-type-use-case.ts`, `list-operation-types-use-case.ts`, `configure-operation-type-capabilities-use-case.ts`/`remove-operation-type-capability-requirement-use-case.ts` (vazby na `CapabilityType`, viz `docs/step-5/machine-capabilities.md`).

## UI

`/tpv/master-data/operation-types` - seznam (kód, název, kategorie, vyžadovaný zdroj, stav) + formulář + rozbalitelný detail s vazbami na požadované/doporučené vlastnosti stroje.
