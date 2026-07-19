# Kmenová data používají stabilní interní identitu, ne podnikový kód

## Status
Přijato (Krok 5 - Správa kmenových dat TPV)

## Context
`docs/adr/0015-internal-id-vs-business-code.md` (Krok 3.5) zavedl pro `Machine` princip "interní `id` ≠ podnikový `code` ≠ externí ERP id". Krok 5 rozšiřuje kmenová data o devět dalších entit (`CapacityGroup` už princip měla, `CapabilityType`, `MachineCapabilityValue`, `OperationType`, `OperationTypeCapabilityRequirement`, `ExternalOperationResource` už měla, `Supplier`, `Tool`, `ToolType`, `ToolMachineCondition`, `Material`, `MaterialGroup`) a dvě z nich (`OperationType`, `ToolType`) se poprvé stávají uživatelsky editovatelnými - riziko, že by se stejná chyba (odvozování identity od zobrazovaného jména/kódu) zopakovala v nové kmenové entitě, aniž by to bylo explicitně zdůvodněné jedním sdíleným rozhodnutím.

## Decision
Všechny entity zavedené/rozšířené v Kroku 5 dodržují stejný vzor:

- `id: string` (`crypto.randomUUID()`) - stabilní, nikdy se neodvozuje od `name`/`code`/`kod`, nikdy se nepřepisuje.
- `code`/`kod` (u entit, které kód mají) - uživatelem zadaný podnikový identifikátor, unikátní v rámci tenanta (kontroluje use case přes `findByCode`, ne value object). Přejmenování (`rename()`) i změna kódu (`changeCode()`) NIKDY nemění `id`.
- Vazby mezi entitami (`Machine.capacityGroupId`, `Tool.toolTypeId`, `MachineCapabilityValue.machineId`, `ToolMachineCondition.toolId/machineId`, ...) vždy odkazují na `id`, nikdy na `code`.

Entity bez uživatelského kódu (`MachineCapabilityValue`, `OperationTypeCapabilityRequirement`) tenhle princip dodržují implicitně - nemají co by kolidovalo s `id`.

## Consequences
- Přejmenování/re-kódování jakékoliv kmenové entity NIKDY nerozbije existující vazby (technologické postupy, kalkulační snapshoty, jiné kmenové záznamy).
- Budoucí ERP konektor (Krok 6) může párovat podle `code`/`kod` bez rizika, že se mezitím pod stejným `id` "podstrčí" jiná entita.
- Cena za konzistenci: každá nová entita nese o jedno pole navíc (`id` i `code`), i tam, kde by teoreticky stačil jen kód - přijato jako cena za jednotnost napříč celým doménovým modelem.
