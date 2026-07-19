import { DomainError } from "./domain-error";

/** Helios (nebo jiný zdroj) odkazuje na kód stroje, který v této organizaci
 *  neexistuje. Nikdy se z toho automaticky nevytváří nový stroj - je to
 *  integrační problém k ručnímu vyřešení (viz docs/adr/0016). */
export class UnknownMachineCodeError extends DomainError {
  constructor(
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`Stroj s kódem "${code}" nebyl v této organizaci nalezen.`);
  }
}
