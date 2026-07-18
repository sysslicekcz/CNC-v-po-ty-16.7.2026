# 0016 – Neznámý externí kód nikdy nezaloží nový stroj automaticky

## Status
Přijato (revidováno dodatkem "ERP-nezávislá architektura" - viz `docs/adr/erp-agnostic-integration-layer.md`; původní verze mluvila konkrétně o Heliosu, zde zobecněno)

## Context
Budoucí integrace s libovolným externím systémem (ERP, MES, ...) - Helios je jen JEDEN možný příklad, appka stejně tak může připojit SAP, K2, vlastní REST API nebo souborovou výměnu (viz `docs/adr/erp-agnostic-integration-layer.md`) - bude appce posílat odkazy na výrobní zdroje podle kódu (`MachineCode`) nebo přes `ExternalReference`. Otázka: co se má stát, když externí systém pošle kód, který appka nezná (překlep, stroj v externím systému ještě není založený v appce, zrušený stroj)?

## Decision
`ResolveMachineByCodeUseCase` (`src/application/machines/resolve-machine-by-code-use-case.ts`) najde stroj podle `[tenantId, code]` a při nenalezení vyhodí `UnknownMachineCodeError` (`src/domain/errors/unknown-machine-code-error.ts`). Stejný princip platí obecně pro `ExternalEntityResolver` (`src/domain/integrations/external-entity-resolver.ts`) - vrátí `"not_found"`, nikdy nezaloží entitu sám. Žádná cesta v appce automaticky nezakládá nový `Machine` (ani jinou lokální entitu) jen proto, že přišel neznámý kód zvenku - je to vždy integrační problém k ručnímu vyřešení (uživatel založí stroj přes `CreateMachineUseCase`, nebo opraví kód na straně externího systému), bez ohledu na to, o jaký konkrétní ERP/konektor jde.

## Consequences
- Nemůže vzniknout "duchový" stroj s nesmyslnými výchozími hodnotami (hodinová sazba, typ) jen kvůli chybě v datech ze zdroje - platí nezávisle na tom, který konkrétní konektor data poslal.
- Integrační vrstva (Krok 4+) musí mít vlastní tok pro "neznámý kód" (fronta k ručnímu spárování/založení), ne tichý fallback - stejný tok pro libovolný `connectorType`.
- `ExternalSystemReference` (`src/domain/value-objects/external-system-reference.ts`, Krok 3.5) byl nahrazen plnohodnotným obecným modelem `ExternalReference`/`ExternalSystem` (`src/domain/integrations/`) - viz `docs/adr/external-system-reference-mapping.md`. Původní `ExternalSystemReference` zůstává jako nepoužitý typ, viz `docs/step-3-5/known-limitations.md`.
