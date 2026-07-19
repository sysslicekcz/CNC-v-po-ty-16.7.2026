import { ToolParameterDefinition } from "@/domain/entities/tool-type";
import { ToolParameterValue } from "@/domain/entities/tool";

/** Validuje `Tool.parameters` proti `ToolType.parameterDefinitions` (Krok 5,
 *  zadání bod 19/37) - povinnost, datový typ, `allowedValues`. Čistá funkce,
 *  sdílená mezi Create/UpdateToolUseCase, aby se pravidlo neduplikovalo. */
export function validateToolParameters(
  definitions: readonly ToolParameterDefinition[],
  values: Record<string, ToolParameterValue>
): string[] {
  const errors: string[] = [];

  for (const def of definitions) {
    const value = values[def.key];
    if (value === undefined || value === null || value === "") {
      if (def.required) errors.push(`Parametr "${def.name}" je povinný.`);
      continue;
    }
    if (def.valueType === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      errors.push(`Parametr "${def.name}" musí být číslo.`);
    } else if (def.valueType === "boolean" && typeof value !== "boolean") {
      errors.push(`Parametr "${def.name}" musí být ano/ne.`);
    } else if (def.valueType === "text" && typeof value !== "string") {
      errors.push(`Parametr "${def.name}" musí být text.`);
    } else if (def.valueType === "selection") {
      if (typeof value !== "string" || !(def.allowedValues ?? []).includes(value)) {
        errors.push(`Parametr "${def.name}" musí být jedna z povolených možností.`);
      }
    }
  }

  return errors;
}
