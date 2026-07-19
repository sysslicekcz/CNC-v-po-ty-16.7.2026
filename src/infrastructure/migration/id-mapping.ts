/**
 * Deterministické id pro migrované záznamy - `tpv-{typ}:{legacyId}` (zadání,
 * bod 10). Legacy id jsou vždy buď crypto.randomUUID() (bezpečné znaky) nebo
 * jednoduché složené klíče typu `${a}:${b}` (taky bezpečné znaky - písmena,
 * číslice, pomlčky, dvojtečky) - žádné escapování/hashování není potřeba, IndexedDB
 * i tenhle formát klíče libovolné takové řetězce bez problému zvládne.
 */
export function deterministicId(prefix: string, legacyId: string): string {
  return `tpv-${prefix}:${legacyId}`;
}
