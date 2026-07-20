import { ToolProfile } from "./tool-profile";
import { CalculationIssue } from "../entities/types";
import { ToolMaterialMismatchWarning } from "../errors/tool-material-mismatch-warning";

/**
 * Kontrola vhodnosti kombinace nástroj/materiál (AP-MCE-001 Fáze B §4/§14 -
 * `ToolMaterialMismatchWarning`). ČISTÁ funkce - `ToolProfile.
 * suitableMaterialGroupIds` už je načtené, žádné další I/O.
 *
 * Prázdný `suitableMaterialGroupIds` znamená "nástroj bez omezení" (chybějící
 * data, ne prokázaná univerzálnost) - nevrací warning, jen appka o vhodnosti
 * nic neví (AP-MCE-001 §18 rozlišuje "nevhodná kombinace" od "chybí data").
 */
export class ToolMaterialCompatibilityService {
  static check(tool: ToolProfile, materialGroupId: string): CalculationIssue[] {
    if (tool.suitableMaterialGroupIds.length === 0) return [];
    if (tool.supportsMaterialGroup(materialGroupId)) return [];

    return [ToolMaterialMismatchWarning.forMismatch(tool.id, materialGroupId).toCalculationIssue()];
  }
}
