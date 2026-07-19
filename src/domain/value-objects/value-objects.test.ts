import { describe, it, expect } from "vitest";
import { Ico } from "./ico";
import { Email } from "./email";
import { Quantity } from "./quantity";
import { HourlyRate } from "./hourly-rate";
import { SortKey } from "./sort-key";
import { OperationNumber } from "./operation-number";
import { ValidationError } from "../errors/validation-error";

describe("Ico", () => {
  it("přijme validní IČO", () => {
    expect(() => Ico.of("27074358")).not.toThrow();
    expect(Ico.of("27074358").toString()).toBe("27074358");
  });

  it("odmítne IČO se špatným kontrolním součtem", () => {
    expect(() => Ico.of("12345678")).toThrow(ValidationError);
  });

  it("odmítne IČO s jiným počtem číslic", () => {
    expect(() => Ico.of("123")).toThrow(ValidationError);
  });
});

describe("Email", () => {
  it("přijme validní e-mail a normalizuje ho na malá písmena", () => {
    expect(Email.of("Info@Firma.CZ").toString()).toBe("info@firma.cz");
  });

  it("odmítne e-mail bez zavináče", () => {
    expect(() => Email.of("neplatny-email")).toThrow(ValidationError);
  });

  it("odmítne e-mail bez domény", () => {
    expect(() => Email.of("a@b")).toThrow(ValidationError);
  });
});

describe("Quantity", () => {
  it("odmítne záporné množství", () => {
    expect(() => Quantity.of(-1, "ks")).toThrow(ValidationError);
  });

  it("odmítne prázdnou jednotku", () => {
    expect(() => Quantity.of(5, "")).toThrow(ValidationError);
  });

  it("povolí nulové množství", () => {
    expect(() => Quantity.of(0, "ks")).not.toThrow();
  });

  it("přijme kladné množství s jednotkou", () => {
    const q = Quantity.of(12, "ks");
    expect(q.value).toBe(12);
    expect(q.unit).toBe("ks");
  });
});

describe("HourlyRate", () => {
  it("odmítne zápornou hodinovou sazbu", () => {
    expect(() => HourlyRate.of(-100)).toThrow(ValidationError);
  });

  it("přijme nulovou i kladnou sazbu s výchozí měnou CZK", () => {
    expect(HourlyRate.of(0).currency).toBe("CZK");
    expect(HourlyRate.of(850).amount).toBe(850);
  });
});

describe("SortKey", () => {
  it("initial() vrací platný klíč", () => {
    expect(() => SortKey.of(SortKey.initial().toString())).not.toThrow();
  });

  it("between() vrací klíč striktně mezi dvěma hodnotami", () => {
    const a = SortKey.initial();
    const b = SortKey.after(a);
    const mid = SortKey.between(a, b);
    expect(a.compareTo(mid)).toBeLessThan(0);
    expect(mid.compareTo(b)).toBeLessThan(0);
  });

  it("opakované vkládání doprostřed nekoliduje s existujícími klíči", () => {
    const a = SortKey.initial();
    const b = SortKey.after(a);
    const left = a;
    let right = b;
    for (let i = 0; i < 20; i++) {
      const mid = SortKey.between(left, right);
      expect(left.compareTo(mid)).toBeLessThan(0);
      expect(mid.compareTo(right)).toBeLessThan(0);
      right = mid;
    }
  });

  it("before()/after() respektují směr", () => {
    const current = SortKey.initial();
    expect(SortKey.before(current).compareTo(current)).toBeLessThan(0);
    expect(SortKey.after(current).compareTo(current)).toBeGreaterThan(0);
  });
});

describe("OperationNumber", () => {
  it("odmítne nekladné nebo neceločíselné hodnoty", () => {
    expect(() => OperationNumber.create(0)).toThrow(ValidationError);
    expect(() => OperationNumber.create(-10)).toThrow(ValidationError);
    expect(() => OperationNumber.create(10.5)).toThrow(ValidationError);
  });

  it("next() navyšuje o krok (výchozí 10)", () => {
    expect(OperationNumber.next(OperationNumber.create(10)).value).toBe(20);
    expect(OperationNumber.next(10).value).toBe(20);
    expect(OperationNumber.next(10, 5).value).toBe(15);
  });
});
