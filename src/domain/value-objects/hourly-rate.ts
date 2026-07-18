import { ValidationError } from "../errors/validation-error";

/** Hodinová sazba zdroje. Měna zatím pevně CZK (aplikace je lokální, k rozšíření
 *  na multi-měnu stačí přidat parametr - pole je tu už teď, aby to nevyžadovalo
 *  změnu tvaru dat). */
export class HourlyRate {
  private constructor(
    private readonly amount: number,
    private readonly currency: string
  ) {}

  static of(amount: number, currency: string = "CZK"): HourlyRate {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError(`Hodinová sazba nesmí být záporná, dostal jsem "${amount}".`);
    }
    return new HourlyRate(amount, currency);
  }

  get value(): number {
    return this.amount;
  }

  get currencyCode(): string {
    return this.currency;
  }

  toString(): string {
    return `${this.amount} ${this.currency}/hod`;
  }
}
