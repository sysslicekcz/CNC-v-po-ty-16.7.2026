import { DomainError } from "./domain-error";

/** Požadovaná operace by porušila invariant mezi entitami (např. duplicitní id
 *  v rámci stromu agregátu). */
export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
