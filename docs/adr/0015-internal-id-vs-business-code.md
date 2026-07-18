# 0015 – Machine.id (interní) odděleno od Machine.code (obchodní/Helios kód)

## Status
Přijato

## Context
Krok 3.5 připravuje appku na budoucí párování s Helios (ERP). Helios identifikuje stroje vlastními výrobními/ERP kódy (např. `300-58140`, `SP-430`), které se mohou v čase měnit (přejmenování, oprava překlepu, reorganizace číslování) - na rozdíl od dnešního `Machine.id`, které appka sama generuje a nikdy nemění.

## Decision
`Machine` má dvě oddělené identity:
- `id: string` - interní stabilní identita. Generuje ji appka (`crypto.randomUUID()`), nikdy se neodvozuje z `name` ani se nepřepisuje Helios kódem, nikdy se nemění po založení. Všechny vnitřní vazby (`Operation.machineId`, `CalculationSnapshot.machineId`) míří sem.
- `code: MachineCode` - uživatelsky/Helios zadávaný kód (`src/domain/value-objects/machine-code.ts`), unikátní jen v rámci `[tenantId, code]` (ne globálně), měnitelný přes `Machine.changeCode()` bez dopadu na `id` ani na existující vazby.

`MachineCode` je záměrně bez normalizace velikosti písmen a bez restriktivního regexu - kódy jako `300-58140` i `KOOP-TEP` musí zůstat čitelné přesně tak, jak byly zadané.

## Consequences
- Přejmenování/oprava kódu stroje nikdy nerozbije `Operation.machineId` ani historické `CalculationSnapshot`.
- Helios integrace (mimo rozsah tohoto kroku) bude párovat podle `code`, ne podle `id` - viz `docs/adr/0016`.
- O unikátnost `[tenantId, code]` se stará primárně use case (`findByCode` před zápisem), IndexedDB unikátní index `tenantId_code` je jen záložní pojistka (`IndexedDbMachineRepository.write()`).
