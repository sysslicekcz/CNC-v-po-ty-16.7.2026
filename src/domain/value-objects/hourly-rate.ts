import { Money, SerializedMoney } from "./money";

/** Hodinová sazba stroje - tenká obálka nad Money, aby bylo v typech vidět, že jde
 *  konkrétně o sazbu za hodinu, ne o libovolnou částku. */
export class HourlyRate {
  private constructor(private readonly money_: Money) {}

  static of(amount: number, currency: string = "CZK"): HourlyRate {
    return new HourlyRate(Money.of(amount, currency));
  }

  static fromMoney(money: Money): HourlyRate {
    return new HourlyRate(money);
  }

  get money(): Money {
    return this.money_;
  }

  get amount(): number {
    return this.money_.amount;
  }

  get currency(): string {
    return this.money_.currency;
  }

  toString(): string {
    return `${this.money_.toString()}/hod`;
  }

  toJSON(): SerializedMoney {
    return this.money_.toJSON();
  }

  static fromJSON(json: SerializedMoney): HourlyRate {
    return HourlyRate.fromMoney(Money.fromJSON(json));
  }
}
