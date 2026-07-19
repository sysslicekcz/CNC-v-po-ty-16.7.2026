import { DomainError } from "./domain-error";

/** Entita s daným id v agregátu/repozitáři neexistuje. */
export class NotFoundError extends DomainError {
  constructor(entityName: string, id: string) {
    super(`${entityName} s id "${id}" nebyl nalezen.`);
  }
}
