/**
 * Sjednocený stav pro kmenová data (Krok 5, zadání bod 4) - jeden název pro
 * "aktivní/neaktivní" napříč VŠEMI novými entitami tohoto kroku. Nahrazuje tři
 * dřív nezávisle definované, ale identické aliasy z Kroku 3.5 (`MachineStatus`,
 * `CapacityGroupStatus`, `ExternalResourceStatus`) - ty teď na `MasterDataStatus`
 * jen ukazují (`export type MachineStatus = MasterDataStatus`), žádná uložená
 * hodnota se neměnila.
 *
 * Starší entity (`OperationType`, `Tool`, `ToolType`, `ToolMachineCondition`)
 * používají místo toho `EntityStav` (`"aktivni" | "neaktivni"`) - VĚDOMĚ
 * NEPŘEJMENOVÁNO (viz docs/audits/step-5-audit.md, docs/step-5/known-limitations.md) -
 * přejmenování by muselo projít mappery/seed daty/migrací/Krokem 4 UI beze
 * skutečné funkční výhody (obě sady hodnot jsou sémanticky identické).
 */
export type MasterDataStatus = "active" | "inactive";
