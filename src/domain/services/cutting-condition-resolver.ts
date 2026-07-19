import { Tool } from "../entities/tool";
import { ToolMachineCondition } from "../entities/tool-machine-condition";
import { CuttingParameters } from "../value-objects/cutting-parameters";

export interface ResolveCuttingConditionsRequest {
  operationTypeId?: string;
  materialId?: string;
}

/**
 * Priorita řezných podmínek (Krok 3 zadání bod 9, rozšířeno Krokem 5 zadání
 * bod 21 o materiál):
 *   1. ToolMachineCondition - čím specifičtější shoda (operationTypeId +
 *      materialId), tím vyšší váha; při shodné specifičnosti rozhoduje `priority`.
 *   2. Tool.defaultCuttingParameters
 *   3. prázdné hodnoty
 *
 * `profiles` musí být PŘEDEM zúžené na správný stroj (a v ideálním případě i
 * tenanta) - resolver sám žádný repository nečte, jen vybírá z toho, co dostal
 * (čistá funkce, žádný I/O). `machiningMode` se v tomto kroku ještě nezohledňuje
 * (pole existuje, výběr podle něj je budoucí rozšíření - viz
 * docs/step-5/known-limitations.md).
 *
 * Vrací vždy novou instanci CuttingParameters - nikdy živý odkaz na hodnoty uložené
 * v Tool/ToolMachineCondition, aby pozdější úprava hodnot v konkrétní Activity
 * nemohla omylem změnit master data.
 */
export function resolveCuttingConditions(
  tool: Tool,
  profiles: ToolMachineCondition[],
  request: ResolveCuttingConditionsRequest
): CuttingParameters {
  const candidates = profiles
    .filter((p) => p.toolId === tool.id)
    .filter((p) => !p.operationTypeId || p.operationTypeId === request.operationTypeId)
    .filter((p) => !p.materialId || p.materialId === request.materialId)
    .map((p) => {
      let specificity = 0;
      if (p.operationTypeId && p.operationTypeId === request.operationTypeId) specificity += 2;
      if (p.materialId && p.materialId === request.materialId) specificity += 1;
      return { profile: p, specificity };
    })
    .sort((a, b) => b.specificity - a.specificity || (b.profile.priority ?? 0) - (a.profile.priority ?? 0));

  const best = candidates[0]?.profile;
  const fromProfile = best?.parameters;
  const fromTool = tool.defaultCuttingParameters;

  return CuttingParameters.of({
    vc: fromProfile?.vc ?? fromTool?.vc,
    feed: fromProfile?.feed ?? fromTool?.feed,
    ap: fromProfile?.ap ?? fromTool?.ap,
  });
}
