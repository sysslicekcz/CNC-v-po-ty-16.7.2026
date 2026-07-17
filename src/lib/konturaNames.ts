import { Row } from "./results";

/** Sesbírá unikátní názvy kontur zadané napříč operacemi (kromě přípravných časů,
 *  kde pole "nazev" znamená název úkonu, ne konturu obrobku). */
export function collectKonturaNames(byId: Record<string, Row[]>): string[] {
  const set = new Set<string>();
  for (const [opId, rows] of Object.entries(byId)) {
    if (opId === "pripravneCasy") continue;
    for (const r of rows) {
      const v = r.kontura;
      if (typeof v === "string" && v.trim()) set.add(v.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "cs"));
}

/** Další volné číslo kontury napříč celým dílem (všechny operace kromě přípravných
 *  časů sdílí jednu řadu, ať je kontura jednoznačná bez ohledu na to, ve které
 *  operaci vznikla). Bere nejvyšší dosud použité číslo + 1, nečíselné/vlastní
 *  názvy kontur ignoruje. */
export function nextKonturaNumber(byId: Record<string, Row[]>): number {
  let max = 0;
  for (const [opId, rows] of Object.entries(byId)) {
    if (opId === "pripravneCasy") continue;
    for (const r of rows) {
      const n = Number(r.kontura);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return max + 1;
}
