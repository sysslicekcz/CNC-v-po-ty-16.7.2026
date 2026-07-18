import { DomainError } from "./domain-error";

/** Vstup nesplňuje invariant doménové entity nebo hodnotového objektu. */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
