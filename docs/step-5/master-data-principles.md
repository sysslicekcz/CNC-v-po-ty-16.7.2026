# Krok 5 – principy kmenových dat

Čtyři principy platí napříč VŠEMI entitami zavedenými/rozšířenými v tomto kroku (Machine, CapacityGroup, CapabilityType, MachineCapabilityValue, OperationType, OperationTypeCapabilityRequirement, ExternalOperationResource, Supplier, Tool, ToolType, ToolMachineCondition, Material, MaterialGroup).

## 1. Interní id ≠ podnikový kód ≠ externí ERP id

Zavedeno už v Kroku 3.5 (`docs/adr/0015-internal-id-vs-business-code.md`) pro `Machine`, Krok 5 ho důsledně dodržuje i pro všechny nové entity:

- `id` (`crypto.randomUUID()`) je stabilní interní identita - NIKDY se neodvozuje od `name`/`code` a nemění se při přejmenování/změně kódu.
- `code`/`kod` je uživatelem zadaný podnikový kód, unikátní v rámci tenanta (ne globálně) - podle něj appka páruje s libovolným ERP.
- Napojení na konkrétní externí systém řeší samostatná vrstva `ExternalReference`/`ExternalSystem` z Kroku 3.5 dodatku - Krok 5 do ní nezasahuje.

## 2. `MasterDataStatus` - sjednocený, ale ne vynucený všude

`domain/entities/master-data-status.ts` definuje `"active" | "inactive"`. Tři dřív duplicitní anglické aliasy (`MachineStatus`, `CapacityGroupStatus`, `ExternalResourceStatus`) teď na něj ukazují (`export type MachineStatus = MasterDataStatus`) - čistě typová deduplikace, žádná uložená hodnota se nezměnila. Nové entity (`CapabilityType`, `MachineCapabilityValue` nemá vlastní stav, `Supplier`, `Material`, `MaterialGroup`) používají `MasterDataStatus` přímo.

Čtyři starší entity (`OperationType`, `Tool`, `ToolType`, `ToolMachineCondition`) používají Czech `EntityStav` (`"aktivni" | "neaktivni"`) - VĚDOMĚ NEPŘEJMENOVÁNO. Přejmenování by muselo projít mappery, seed daty, migrací a Krok 4 kódem (`activity-table.tsx` aj.), aniž by přineslo funkční zisk - zdokumentováno jako přijatá nekonzistence, viz `docs/step-5/known-limitations.md`.

## 3. Deaktivace před smazáním

Popsáno v `docs/step-5/deactivation-and-history.md` - shrnutí: každá entita má `Deactivate*UseCase`/`setStatus/setStav`, který NIKDY nemaže záznam. Fyzické smazání (kde vůbec existuje - `Machine`, `CapacityGroup`, `ExternalOperationResource`) je chráněné `MasterDataUsageChecker` a vyhodí `MasterDataInUseError`, pokud je záznam používaný.

## 4. Tenant scope

Všechny entity mají `tenantId: string` (povinné) a repository rozhraní s `tenantId` parametrem na každé čtecí/mazací metodě. `OperationType`/`ToolType` byly poprvé v tomhle kroku převedené z globálního číselníku na tenant-scoped data (DB migrace v4→v5 s backfillem, viz `docs/adr/master-data-use-stable-internal-identities.md` a `docs/step-5/operation-types.md`).

## 5. Licence řídí čtení i zápis, ne mazání dat

Každý use case volá `featureAccessService.require(FeatureCode, "read"|"write")` jako první krok (po `tenantContext.requireCurrentTenantId()`), založení navíc `assertWithinLimit(...)`. Snížení licenčního limitu NIKDY nemaže existující záznamy - jen zamezí založení NOVÝCH nad limit (stejný princip jako `docs/adr/0022-license-does-not-delete-data.md` z Kroku 3.5).
