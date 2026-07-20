import { CalculationSeverity } from "../enums/calculation-severity";

/**
 * Jedna položka z `CalculationResult.warnings` (AP-MCE-001 §18) - `code` je
 * strojově čitelný ("MACHINE_NOT_FOUND", "TOOL_LIFE_UNKNOWN", ...), `message`
 * lidsky čitelné vysvětlení. `field`, pokud je vyplněné, ukazuje na konkrétní
 * pole vstupu (stejný tvar jako chybová odpověď API v AP-MCE-001 §12).
 */
export interface CalculationIssue {
  code: string;
  severity: CalculationSeverity;
  message: string;
  field?: string;
}
