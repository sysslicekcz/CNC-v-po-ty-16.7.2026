/** Požadovaná operace by porušila invariant mezi entitami (např. neplatný přechod stavu). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
