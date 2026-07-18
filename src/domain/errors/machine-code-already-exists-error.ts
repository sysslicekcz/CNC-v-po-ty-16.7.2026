import { ConflictError } from "./conflict-error";

/** Kód stroje musí být unikátní v rámci tenanta (ne globálně) - viz docs/adr/0015. */
export class MachineCodeAlreadyExistsError extends ConflictError {
  constructor(
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`Stroj s kódem "${code}" už v této organizaci existuje.`);
  }
}
