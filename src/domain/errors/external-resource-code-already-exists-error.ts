import { ConflictError } from "./conflict-error";

/** Kód kooperačního zdroje musí být unikátní v rámci tenanta (ne globálně) - viz docs/adr/0018. */
export class ExternalResourceCodeAlreadyExistsError extends ConflictError {
  constructor(
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`Kooperační zdroj s kódem "${code}" už v této organizaci existuje.`);
  }
}
