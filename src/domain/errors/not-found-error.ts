/** Entita s daným id v repozitáři neexistuje. */
export class NotFoundError extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} s id "${id}" nebyl nalezen.`);
    this.name = "NotFoundError";
  }
}
