/** Vstup nesplňuje invariant doménové entity nebo hodnotového objektu. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
