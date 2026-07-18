import { Tool } from "../entities/tool";
import { ToolMachineCondition } from "../entities/tool-machine-condition";
import { CuttingParameters } from "../value-objects/cutting-parameters";

/**
 * Třívrstvá priorita řezných podmínek (viz zadání, bod 9):
 *   1. ToolMachineCondition (profil pro daný stroj, případně zpřesněný operationTypeId)
 *   2. Tool.defaultCuttingParameters
 *   3. prázdné hodnoty
 *
 * Vybírá z `profiles` ten s odpovídajícím (nebo obecným) operationTypeId a
 * nejvyšší prioritou. Materiál a machiningMode se v tomto kroku ještě nezohledňují
 * (pole na ToolMachineCondition existují, výběr podle nich je budoucí rozšíření).
 *
 * Vrací vždy novou instanci CuttingParameters - nikdy živý odkaz na hodnoty uložené
 * v Tool/ToolMachineCondition, aby pozdější úprava hodnot v konkrétní Activity
 * nemohla omylem změnit master data.
 */
export function resolveCuttingConditions(
  tool: Tool,
  profiles: ToolMachineCondition[],
  operationTypeId: string
): CuttingParameters {
  const matching = profiles
    .filter((p) => p.toolId === tool.id)
    .filter((p) => !p.operationTypeId || p.operationTypeId === operationTypeId)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const best = matching[0];
  const fromProfile = best?.parameters;
  const fromTool = tool.defaultCuttingParameters;

  return CuttingParameters.of({
    vc: fromProfile?.vc ?? fromTool?.vc,
    feed: fromProfile?.feed ?? fromTool?.feed,
    ap: fromProfile?.ap ?? fromTool?.ap,
  });
}
