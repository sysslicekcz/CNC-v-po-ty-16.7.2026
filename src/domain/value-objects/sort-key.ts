import { ValidationError } from "../errors/validation-error";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const MAX_DEPTH = 64; // bezpečnostní pojistka proti nekonečné smyčce, prakticky nedosažitelná

function digitAt(key: string, i: number): number {
  return i < key.length ? ALPHABET.indexOf(key[i]) : 0;
}

/** Vygeneruje base62 řetězec striktně mezi `lo` (dolní mez, "" = úplně dole) a `hi`
 *  (horní mez, null = neomezeno nahoru). Jde o zjednodušenou variantu fractional
 *  indexing (LexoRank-styl): vkládání mezi dva sousední klíče nikdy nevyžaduje
 *  přepočítat/přepsat žádný jiný záznam. */
function generateBetween(lo: string, hi: string | null): string {
  let result = "";
  let upperUnbounded = hi === null;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const loDigit = digitAt(lo, i);
    const hiDigit = upperUnbounded ? BASE : digitAt(hi as string, i);
    const gap = hiDigit - loDigit;
    if (gap > 1) {
      result += ALPHABET[loDigit + Math.floor(gap / 2)];
      return result;
    }
    // gap je 0 nebo 1 - na tomhle místě není mezera, jdeme o úroveň hlouběji
    result += ALPHABET[loDigit];
    if (gap === 1) upperUnbounded = true; // od tohoto místa už nás horní mez neomezuje
  }
  return result + ALPHABET[1];
}

/** Stabilní řadicí klíč pro Operation/Activity - viz zadání: přesun operace mezi dvě
 *  existující nesmí vyžadovat přepis sortKey ostatních záznamů. */
export class SortKey {
  private constructor(private readonly value: string) {}

  static of(value: string): SortKey {
    if (!value || ![...value].every((c) => ALPHABET.includes(c))) {
      throw new ValidationError(`Neplatný SortKey: "${value}"`);
    }
    return new SortKey(value);
  }

  /** První klíč pro prázdný seznam (nastavený doprostřed prostoru, aby bylo
   *  rovnoměrně místo pro vkládání na obě strany). */
  static initial(): SortKey {
    return new SortKey(ALPHABET[Math.floor(BASE / 2)]);
  }

  /** Klíč striktně mezi `a` a `b`. `a`/`b` mohou chybět (vložení na začátek/konec seznamu). */
  static between(a: SortKey | null, b: SortKey | null): SortKey {
    if (a && b && a.value >= b.value) {
      throw new ValidationError("SortKey.between: 'a' musí být menší než 'b'.");
    }
    return new SortKey(generateBetween(a?.value ?? "", b?.value ?? null));
  }

  toString(): string {
    return this.value;
  }

  compareTo(other: SortKey): number {
    return this.value < other.value ? -1 : this.value > other.value ? 1 : 0;
  }

  equals(other: SortKey): boolean {
    return this.value === other.value;
  }
}
