import { DomainError } from "./domain-error";

/** Požadovaná akce není v aktuálním stavu entity dovolená (např. úprava vydaného
 *  technologického postupu). */
export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
