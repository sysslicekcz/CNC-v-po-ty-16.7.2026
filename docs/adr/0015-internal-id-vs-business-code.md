# 0015 – Machine.id (interní) odděleno od Machine.code (podnikový kód)

## Status
Přijato (terminologie revidována dodatkem "ERP-nezávislá architektura" - `code` je obecný podnikový kód, ne kód konkrétního ERP, viz `docs/adr/erp-agnostic-integration-layer.md`)

## Context
Krok 3.5 připravuje appku na budoucí párování s libovolným externím systémem (ERP, MES, ...) - Helios je jen JEDEN možný příklad takového systému, appka stejně tak může připojit SAP, K2, ABRA, vlastní REST API nebo souborovou výměnu. Externí systémy identifikují stroje vlastními výrobními/ERP kódy (např. `300-58140`, `SP-430`), které se mohou v čase měnit (přejmenování, oprava překlepu, reorganizace číslování) - na rozdíl od dnešního `Machine.id`, které appka sama generuje a nikdy nemění.

## Decision
`Machine` má dvě oddělené identity:
- `id: string` - interní stabilní identita. Generuje ji appka (`crypto.randomUUID()`), nikdy se neodvozuje z `name` ani se nepřepisuje kódem z žádného externího systému, nikdy se nemění po založení. Všechny vnitřní vazby (`Operation.machineId`, `CalculationSnapshot.machineId`) míří sem.
- `code: MachineCode` - uživatelsky zadávaný PODNIKOVÝ kód (`src/domain/value-objects/machine-code.ts`), unikátní jen v rámci `[tenantId, code]` (ne globálně), měnitelný přes `Machine.changeCode()` bez dopadu na `id` ani na existující vazby. `code` je podnikový kód stroje/pracoviště používaný zákazníkem - NENÍ to automaticky kód konkrétního ERP; vazba na konkrétní externí systém (Helios i jakýkoliv jiný) je samostatný koncept, viz `ExternalReference` (`docs/adr/external-system-reference-mapping.md`).

`MachineCode` je záměrně bez normalizace velikosti písmen a bez restriktivního regexu - kódy jako `300-58140` i `KOOP-TEP` musí zůstat čitelné přesně tak, jak byly zadané.

## Consequences
- Přejmenování/oprava kódu stroje nikdy nerozbije `Operation.machineId` ani historické `CalculationSnapshot`.
- Budoucí integrace s libovolným externím systémem (mimo rozsah tohoto kroku) bude moci párovat podle `code` (přes `businessCode` v `ExternalEntityResolver`) i/nebo podle `ExternalReference`, nikdy podle `id` - viz `docs/adr/0016`.
- O unikátnost `[tenantId, code]` se stará primárně use case (`findByCode` před zápisem), IndexedDB unikátní index `tenantId_code` je jen záložní pojistka (`IndexedDbMachineRepository.write()`).
