/** Základ pro všechny doménové chyby - technologicky neutrální, žádné HTTP status
 *  kódy. Mapování na HTTP/UI hlášky patří do Presentation/Application vrstvy. */
export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
