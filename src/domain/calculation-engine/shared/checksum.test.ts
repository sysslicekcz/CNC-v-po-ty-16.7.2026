import { describe, it, expect } from "vitest";
import { computeContentChecksum } from "./checksum";

describe("computeContentChecksum", () => {
  it("je deterministický pro stejný obsah", () => {
    const value = { a: 1, b: { c: 2, d: [1, 2, 3] } };
    expect(computeContentChecksum(value)).toBe(computeContentChecksum({ a: 1, b: { c: 2, d: [1, 2, 3] } }));
  });

  it("nezávisí na pořadí klíčů objektu", () => {
    expect(computeContentChecksum({ a: 1, b: 2 })).toBe(computeContentChecksum({ b: 2, a: 1 }));
  });

  it("liší se pro odlišný obsah", () => {
    expect(computeContentChecksum({ a: 1 })).not.toBe(computeContentChecksum({ a: 2 }));
  });
});
