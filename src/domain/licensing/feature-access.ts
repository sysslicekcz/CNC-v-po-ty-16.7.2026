/** Režim přístupu k jedné funkci (Krok 3.5, bod 21). Preferovaný model místo
 *  prostého boolean "povoleno/zakázáno" - umožňuje např. `routing.view = read`
 *  zatímco `routing.edit = none`, beze změny všech use casů, až bude potřeba
 *  rozlišení zavést i jinde. */
export type FeatureAccess = "none" | "read" | "write" | "full";

const ACCESS_RANK: Record<FeatureAccess, number> = { none: 0, read: 1, write: 2, full: 3 };

/** `actual` pokrývá `required`, pokud je na stejné nebo vyšší úrovni (full
 *  pokrývá vše, write pokrývá read i write, ...). */
export function satisfiesAccess(actual: FeatureAccess, required: FeatureAccess): boolean {
  return ACCESS_RANK[actual] >= ACCESS_RANK[required];
}
