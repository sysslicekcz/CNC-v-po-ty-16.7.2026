# Machine.id vs. Machine.code

Viz `docs/adr/0015-internal-id-vs-business-code.md` a `docs/adr/0016-helios-resource-code-mapping.md` pro rozhodnutí. Tenhle dokument je praktický přehled.

## Dvě identity

| | `Machine.id` | `Machine.code` |
|---|---|---|
| Kdo přiděluje | appka (`crypto.randomUUID()`) | uživatel / Helios |
| Mění se? | nikdy | ano (`Machine.changeCode()`) |
| Unikátnost | globální (UUID) | `[tenantId, code]` |
| Na co se odkazují vazby appky | `Operation.machineId`, `CalculationSnapshot.machineId` | (zatím) nic uvnitř appky - připraveno pro Helios |
| Typ | `string` | `MachineCode` (Value Object) |

## `MachineCode` pravidla

`src/domain/value-objects/machine-code.ts`: nesmí být prázdný (po ořezání mezer), zachovává přesnou velikost písmen i pomlčky, žádný restriktivní regex - kódy nejsou jen číslice (`"300-58140"`, `"SP-430"`, `"KOOP-TEP"` musí zůstat čitelné přesně tak, jak byly zadané).

## Kde se unikátnost hlídá

1. **Primárně v use casu** - `CreateMachineUseCase`/`UpdateMachineUseCase` volají `machineRepository.findByCode(tenantId, code)` PŘED zápisem a vyhodí `MachineCodeAlreadyExistsError`, pokud kód už existuje.
2. **Záložně v IndexedDB** - unikátní compound index `tenantId_code` na store `tpvMachines` (přidaný v `DB_VERSION 2`). `IndexedDbMachineRepository.write()` odchytává nativní `ConstraintError` a překládá ho na stejnou doménovou `MachineCodeAlreadyExistsError` - takže i při race condition (souběžný zápis) appka nikdy neprotéká syrovou `DOMException` ven z repozitáře.

Stejný dvouvrstvý vzor (use case + DB unique index jako pojistka) je použitý i pro `CapacityGroupCode` a `ExternalResourceCode`.

## Legacy migrace a fallback kód

Legacy `machines` store (Krok 3 a dřív) neměl žádné pole pro kód - appka ho nikdy neukládala. Protože `Machine.code` je teď POVINNÉ pole domény, `migrate-machines.ts` (`src/infrastructure/migration/phases/migrate-machines.ts`) přidělí každému migrovanému stroji deterministický fallback `LEGACY-MACHINE-{legacyId}` a zaloguje `warning` issue s doporučením doplnit skutečný Helios kód - žádný stroj se migrací neztratí ani nedostane tichý/nesmyslný kód.

## Neznámý kód nikdy nezaloží stroj

`ResolveMachineByCodeUseCase` (`src/application/machines/resolve-machine-by-code-use-case.ts`) při nenalezení kódu vyhodí `UnknownMachineCodeError` - nikdy automaticky nezaloží nový `Machine`. Viz `docs/adr/0016`.
