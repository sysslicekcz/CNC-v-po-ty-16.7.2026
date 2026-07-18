/** Jednoduchý deterministický FNV-1a řetězcový hash - stačí na "otisk" zálohy pro
 *  kontrolu integrity (ne kryptografické zabezpečení). Bez závislosti na
 *  crypto.subtle (async, nemusí být dostupné stejně ve všech prostředích/testech). */
export function fnv1aChecksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
