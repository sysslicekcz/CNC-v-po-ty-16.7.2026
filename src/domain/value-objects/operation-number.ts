import { ValidationError } from "../errors/validation-error";

const DEFAULT_STEP = 10;

/** Zobrazovací číslo operace (10, 20, 30...) - čistě popisné, neřídí fyzické řazení
 *  (to dělá SortKey). Změna OperationNumber (přečíslování) nikdy nemění SortKey a
 *  naopak. */
export class OperationNumber {
  private constructor(private readonly value_: number) {}

  static create(value: number): OperationNumber {
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError(`OperationNumber musí být kladné celé číslo, dostal jsem "${value}".`);
    }
    return new OperationNumber(value);
  }

  static next(current: OperationNumber | number, step: number = DEFAULT_STEP): OperationNumber {
    const currentValue = current instanceof OperationNumber ? current.value_ : current;
    return OperationNumber.create(currentValue + step);
  }

  get value(): number {
    return this.value_;
  }

  toString(): string {
    return String(this.value_);
  }

  toJSON(): number {
    return this.value_;
  }

  static fromJSON(value: number): OperationNumber {
    return OperationNumber.create(value);
  }

  equals(other: OperationNumber): boolean {
    return this.value_ === other.value_;
  }
}
