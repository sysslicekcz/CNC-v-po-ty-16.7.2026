import { ConflictError } from "./conflict-error";

/** Kód externího systému musí být unikátní v rámci tenanta (ne globálně). */
export class ExternalSystemCodeAlreadyExistsError extends ConflictError {
  constructor(
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`Externí systém s kódem "${code}" už v této organizaci existuje.`);
  }
}
