import { ValidationError } from "../errors/validation-error";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const MAX_DEPTH = 64; // bezpečnostní pojistka proti nekonečné smyčce, prakticky nedosažitelná

function digitAt(key: string, i: number): number {
  return i < key.length ? ALPHABET.indexOf(key[i]) : 0;
}

/** Vygeneruje base62 řetězec striktně mezi `lo` (dolní mez, "" = úplně dole) a `hi`
 *  (horní mez, null = neomezeno nahoru). Zjednodušená varianta fractional indexing
 *  (LexoRank-styl, deterministický algoritmus) - vkládání mezi dva sousední klíče
 *  nikdy nevyžaduje přepočítat/přepsat žádný jiný záznam. Neuchovává pořadí jako
 *  plovoucí číslo (number) - to by se dlouhodobě vyčerpalo přesností. */
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

/** Stabilní řadicí klíč pro Operation/Position/Activity - přesun mezi dvě existující
 *  položky nesmí vyžadovat přepis sortKey ostatních záznamů. Immutable obálka nad
 *  stringem. */
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

  /** Klíč striktně mezi `left` a `right`. Kterýkoli z nich může chybět (vložení na
   *  začátek/konec seznamu). */
  static between(left: SortKey | null, right: SortKey | null): SortKey {
    if (left && right && left.value >= right.value) {
      throw new ValidationError("SortKey.between: 'left' musí být menší než 'right'.");
    }
    return new SortKey(generateBetween(left?.value ?? "", right?.value ?? null));
  }

  /** Klíč hned za `current` (žádná horní mez). */
  static after(current: SortKey): SortKey {
    return SortKey.between(current, null);
  }

  /** Klíč hned před `current` (žádná dolní mez). */
  static before(current: SortKey): SortKey {
    return SortKey.between(null, current);
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }

  static fromJSON(value: string): SortKey {
    return SortKey.of(value);
  }

  compareTo(other: SortKey): number {
    return this.value < other.value ? -1 : this.value > other.value ? 1 : 0;
  }

  equals(other: SortKey): boolean {
    return this.value === other.value;
  }
}
