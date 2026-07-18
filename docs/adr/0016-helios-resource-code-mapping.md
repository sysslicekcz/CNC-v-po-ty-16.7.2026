# 0016 – Neznámý Helios kód nikdy nezaloží nový stroj automaticky

## Status
Přijato

## Context
Budoucí Helios integrace (mimo rozsah Kroku 3.5) bude appce posílat odkazy na výrobní zdroje podle kódu (`MachineCode`). Otázka: co se má stát, když Helios pošle kód, který appka nezná (překlep, stroj v Heliosu ještě není založený v appce, zrušený stroj)?

## Decision
`ResolveMachineByCodeUseCase` (`src/application/machines/resolve-machine-by-code-use-case.ts`) najde stroj podle `[tenantId, code]` a při nenalezení vyhodí `UnknownMachineCodeError` (`src/domain/errors/unknown-machine-code-error.ts`). Žádná cesta v appce automaticky nezakládá nový `Machine` jen proto, že přišel neznámý kód zvenku - je to vždy integrační problém k ručnímu vyřešení (uživatel založí stroj přes `CreateMachineUseCase`, nebo opraví kód na straně Heliosu).

## Consequences
- Nemůže vzniknout "duchový" stroj s nesmyslnými výchozími hodnotami (hodinová sazba, typ) jen kvůli chybě v datech ze zdroje.
- Integrační vrstva (Krok 4+) musí mít vlastní tok pro "neznámý kód" (fronta k ručnímu spárování/založení), ne tichý fallback.
- `ExternalSystemReference` (`src/domain/value-objects/external-system-reference.ts`) je připravený tvar dat pro budoucí Helios párování, zatím nikde nepoužitý - viz `docs/step-3-5/known-limitations.md`.
