/**
 * Port pro "kdo je aktuální tenant" (Krok 3.5, bod 12) - doména/aplikační
 * vrstva nikdy nečte localStorage/IndexedDB/cookies/session/React context
 * přímo, jen tohle rozhraní. Konkrétní implementace (dnes `LocalTenantContext`,
 * později např. odvozená z přihlášeného uživatele) žije v infrastructure.
 */
export interface TenantContext {
  getCurrentTenantId(): string | null;
  requireCurrentTenantId(): string;
}
