import { ConflictError } from "./conflict-error";

/** Kód skupiny kapacity musí být unikátní v rámci tenanta (ne globálně) - viz docs/adr/0017. */
export class CapacityGroupCodeAlreadyExistsError extends ConflictError {
  constructor(
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`Skupina kapacity s kódem "${code}" už v této organizaci existuje.`);
  }
}
