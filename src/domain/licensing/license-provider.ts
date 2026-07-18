import { License } from "./license";

/**
 * Zdroj AKTUÁLNÍ EFEKTIVNÍ licence (Krok 3.5, bod 23) - Application vrstva
 * nikdy nečte licenci přímo z IndexedDB, jen přes tohle rozhraní. Oddělené od
 * `LicenseRepository` (čistá persistence) - budoucí implementace mohou být
 * `RemoteLicenseProvider`/`CachedRemoteLicenseProvider` beze změny volajícího
 * kódu (docs/adr/0021).
 */
export interface LicenseProvider {
  getCurrentLicense(): Promise<License>;
}
