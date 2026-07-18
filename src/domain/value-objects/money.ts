import { ValidationError } from "../errors/validation-error";

export interface SerializedMoney {
  amount: number;
  currency: string;
}

/** Obecná peněžní částka - základ pro HourlyRate a budoucí kalkulaci ceny (viz
 *  zadání, "Budoucí moduly"). Měna je ISO-like kód (např. "CZK"), neomezuje se
 *  na jednu měnu natvrdo. */
export class Money {
  private constructor(
    private readonly amount_: number,
    private readonly currency_: string
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ValidationError(`Částka nesmí být záporná, dostal jsem "${amount}".`);
    }
    if (!currency.trim()) {
      throw new ValidationError("Money: 'currency' nesmí být prázdná.");
    }
    return new Money(amount, currency.trim().toUpperCase());
  }

  get amount(): number {
    return this.amount_;
  }

  get currency(): string {
    return this.currency_;
  }

  toString(): string {
    return `${this.amount_} ${this.currency_}`;
  }

  toJSON(): SerializedMoney {
    return { amount: this.amount_, currency: this.currency_ };
  }

  static fromJSON(json: SerializedMoney): Money {
    return Money.of(json.amount, json.currency);
  }
}
