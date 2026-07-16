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
