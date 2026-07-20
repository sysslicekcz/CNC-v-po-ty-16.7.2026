/**
 * Barrel pro chybové třídy Manufacturing Calculation Engine (AP-MCE-001 §18).
 *
 * `ValidationError` se ZÁMĚRNĚ znovu neimplementuje - existující
 * `@/domain/errors/validation-error` už přesně dělá to, co AP-MCE-001 popisuje
 * (neplatný vstup hodnotového objektu/entity). Duplicitní třída se stejným
 * jménem v jiné složce by jen matla ("který ValidationError?"), přesně proti
 * duchu zadání ("žádná duplicita"). Re-export tady je jen pohodlný jediný
 * import pro kód uvnitř `calculation-engine`.
 */
export { ValidationError } from "@/domain/errors/validation-error";
export { CalculationError, UnknownOperationCategoryError } from "./calculation-error";
export { MachineLimitError } from "./machine-limit-error";
export { MaterialError } from "./material-error";
export { ToolError } from "./tool-error";

// AP-MCE-001 Fáze B §14
export {
  MaterialProfileNotFoundError,
  MachineProfileNotFoundError,
  ToolProfileNotFoundError,
  CuttingConditionNotFoundError,
} from "./profile-not-found-error";
export { InvalidMaterialCoefficientError, InvalidMachineCoefficientError } from "./invalid-coefficient-error";
export { InvalidToolLifeError } from "./invalid-tool-life-error";
export { MachineCapabilityMissingError } from "./machine-capability-missing-error";
export { MachineEnvelopeExceededError } from "./machine-envelope-exceeded-error";
export { ToolMaterialMismatchWarning } from "./tool-material-mismatch-warning";
export { ProfileVersionConflictError } from "./profile-version-conflict-error";
export { CrossTenantAccessError } from "./cross-tenant-access-error";
