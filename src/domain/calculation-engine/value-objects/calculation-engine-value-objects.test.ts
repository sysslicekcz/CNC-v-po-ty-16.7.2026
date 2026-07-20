import { describe, it, expect } from "vitest";
import { ValidationError } from "@/domain/errors/validation-error";
import { Time } from "./time";
import { Length } from "./length";
import { Diameter } from "./diameter";
import { Quantity } from "./quantity";
import { CuttingSpeed } from "./cutting-speed";
import { FeedRate } from "./feed-rate";
import { SpindleSpeed } from "./spindle-speed";
import { MachinePower } from "./machine-power";
import { ToolLife } from "./tool-life";

describe("Time", () => {
  it("přijme nulu i kladnou hodnotu, odmítne zápornou", () => {
    expect(Time.zero().minutes).toBe(0);
    expect(Time.ofMinutes(5).minutes).toBe(5);
    expect(() => Time.ofMinutes(-1)).toThrow(ValidationError);
  });

  it("ofSeconds převádí na minuty", () => {
    expect(Time.ofSeconds(90).minutes).toBeCloseTo(1.5);
  });

  it("plus/times/withPercentageAllowance počítají správně a nemutují operandy", () => {
    const a = Time.ofMinutes(10);
    const b = Time.ofMinutes(4);
    expect(a.plus(b).minutes).toBe(14);
    expect(a.minutes).toBe(10); // nemutováno
    expect(a.times(3).minutes).toBe(30);
    expect(a.withPercentageAllowance(0.1).minutes).toBeCloseTo(11);
  });

  it("odmítne záporný násobitel/přirážku", () => {
    const a = Time.ofMinutes(10);
    expect(() => a.times(-1)).toThrow(ValidationError);
    expect(() => a.withPercentageAllowance(-0.1)).toThrow(ValidationError);
  });

  it("round-trip přes JSON", () => {
    expect(Time.fromJSON(Time.ofMinutes(7).toJSON()).minutes).toBe(7);
  });
});

describe("Length", () => {
  it("přijme nulu, odmítne zápornou hodnotu", () => {
    expect(Length.zero().millimeters).toBe(0);
    expect(() => Length.ofMillimeters(-1)).toThrow(ValidationError);
  });

  it("ofInches převádí na milimetry", () => {
    expect(Length.ofInches(1).millimeters).toBeCloseTo(25.4);
  });

  it("minus odmítne výsledek pod nulu", () => {
    const a = Length.ofMillimeters(5);
    const b = Length.ofMillimeters(10);
    expect(() => a.minus(b)).toThrow(ValidationError);
    expect(b.minus(a).millimeters).toBe(5);
  });
});

describe("Diameter", () => {
  it("odmítne nulu i zápornou hodnotu (AP-MCE-001 §18)", () => {
    expect(() => Diameter.ofMillimeters(0)).toThrow(ValidationError);
    expect(() => Diameter.ofMillimeters(-10)).toThrow(ValidationError);
  });

  it("přijme kladnou hodnotu a spočítá poloměr", () => {
    const d = Diameter.ofMillimeters(40);
    expect(d.millimeters).toBe(40);
    expect(d.radiusMillimeters).toBe(20);
  });
});

describe("Quantity (calculation-engine)", () => {
  it("odmítne nulu, zápornou i neceločíselnou hodnotu (AP-MCE-001 §18: quantity > 0)", () => {
    expect(() => Quantity.ofPieces(0)).toThrow(ValidationError);
    expect(() => Quantity.ofPieces(-5)).toThrow(ValidationError);
    expect(() => Quantity.ofPieces(2.5)).toThrow(ValidationError);
  });

  it("přijme kladné celé číslo", () => {
    expect(Quantity.ofPieces(500).pieces).toBe(500);
  });
});

describe("CuttingSpeed", () => {
  it("přijme nulu, odmítne zápornou hodnotu", () => {
    expect(CuttingSpeed.ofMetersPerMinute(0).metersPerMinute).toBe(0);
    expect(() => CuttingSpeed.ofMetersPerMinute(-1)).toThrow(ValidationError);
  });
});

describe("FeedRate", () => {
  it("odmítne zápornou hodnotu", () => {
    expect(() => FeedRate.of(-0.1, "mm_per_rev")).toThrow(ValidationError);
  });

  it("nese jednotku a assertUnit ji ověří", () => {
    const f = FeedRate.of(0.2, "mm_per_rev");
    expect(f.assertUnit("mm_per_rev")).toBe(0.2);
    expect(() => f.assertUnit("mm_per_tooth")).toThrow(ValidationError);
  });

  it("round-trip přes JSON zachová jednotku", () => {
    const f = FeedRate.of(0.15, "mm_per_tooth");
    expect(FeedRate.fromJSON(f.toJSON()).unit).toBe("mm_per_tooth");
  });
});

describe("SpindleSpeed", () => {
  it("odmítne nulu i zápornou hodnotu (AP-MCE-001 §18: rpm > 0)", () => {
    expect(() => SpindleSpeed.ofRpm(0)).toThrow(ValidationError);
    expect(() => SpindleSpeed.ofRpm(-100)).toThrow(ValidationError);
  });

  it("fromCuttingSpeed odvodí otáčky z Vc a průměru (n = Vc*1000/(π*D))", () => {
    const vc = CuttingSpeed.ofMetersPerMinute(100);
    const d = Diameter.ofMillimeters(50);
    const n = SpindleSpeed.fromCuttingSpeed(vc, d);
    expect(n.rpm).toBeCloseTo((100 * 1000) / (Math.PI * 50), 3);
  });

  it("cuttingSpeedAt je inverzní k fromCuttingSpeed", () => {
    const original = CuttingSpeed.ofMetersPerMinute(120);
    const d = Diameter.ofMillimeters(30);
    const n = SpindleSpeed.fromCuttingSpeed(original, d);
    expect(n.cuttingSpeedAt(d).metersPerMinute).toBeCloseTo(120, 6);
  });
});

describe("MachinePower", () => {
  it("odmítne zápornou hodnotu", () => {
    expect(() => MachinePower.ofKilowatts(-1)).toThrow(ValidationError);
  });

  it("exceeds porovná proti dostupnému výkonu", () => {
    const required = MachinePower.ofKilowatts(15);
    const available = MachinePower.ofKilowatts(10);
    expect(required.exceeds(available)).toBe(true);
    expect(available.exceeds(required)).toBe(false);
  });
});

describe("ToolLife", () => {
  it("odmítne nekladné hodnoty", () => {
    expect(() => ToolLife.ofPieces(0)).toThrow(ValidationError);
    expect(() => ToolLife.ofMinutes(-5)).toThrow(ValidationError);
  });

  it("plannedChangesForBatch počítá ceil(quantity / toolLifePieces)", () => {
    const life = ToolLife.ofPieces(120);
    expect(life.plannedChangesForBatch(500)).toBe(5); // ceil(500/120) = 5
    expect(life.plannedChangesForBatch(120)).toBe(1);
  });

  it("unlimited a minutes vrací 0 plánovaných výměn (Fáze A neumí minuty převést na kusy)", () => {
    expect(ToolLife.unlimited().plannedChangesForBatch(500)).toBe(0);
    expect(ToolLife.ofMinutes(30).plannedChangesForBatch(500)).toBe(0);
  });

  it("round-trip přes JSON zachová basis", () => {
    expect(ToolLife.fromJSON(ToolLife.ofPieces(80).toJSON()).basis).toBe("pieces");
    expect(ToolLife.fromJSON(ToolLife.unlimited().toJSON()).basis).toBe("unlimited");
  });
});
