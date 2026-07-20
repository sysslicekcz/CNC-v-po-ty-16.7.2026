/**
 * Deterministický "content hash" pro snapshoty (AP-MCE-001 Fáze B §10:
 * "checksum nebo content hash"). ZÁMĚRNĚ synchronní a bez kryptografické
 * knihovny - `crypto.subtle.digest` je asynchronní, což by snapshoty (které
 * vznikají jako immutable vedlejší produkt synchronních factory metod)
 * zbytečně zkomplikovalo. Účel checksumu je ZDE detekce shody/změny obsahu
 * (dva snapshoty se stejným obsahem musí dát stejný checksum, offline, bez
 * závislosti na prostředí), ne kryptografická odolnost proti kolizím.
 *
 * FNV-1a nad stabilně seřazeným JSON (klíče objektů seřazené abecedně, aby
 * `{a:1,b:2}` a `{b:2,a:1}` daly STEJNÝ checksum) - malé, čisté, synchronní,
 * funguje identicky v prohlížeči i v Node (testy).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function computeContentChecksum(value: unknown): string {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
