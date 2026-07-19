import { ensureDefaultTenantAndLicense } from "@/infrastructure/licensing/seed-default-tenant";

let bootstrapPromise: Promise<void> | null = null;

/**
 * Zaručí, že výchozí tenant a jeho licence existují DŘÍV, než libovolná
 * `/tpv/*` stránka začne přes use casy číst tenant-scoped data (Krok 6 -
 * integrace/UX dotažení).
 *
 * `ensureDefaultTenantAndLicense` se dřív volalo JEN uvnitř migračního enginu
 * (dev nástroj `/dev/tpv-migration`) - čerstvý prohlížeč, který tudy nikdy
 * neprošel (typicky uživatel, co poprvé otevře rovnou `/tpv`), neměl tenanta
 * vůbec. `DefaultFeatureAccessService` na chybějícího tenanta reaguje
 * `TenantNotActiveError` u KAŽDÉ funkce, takže se to v UI tvářilo jako
 * licenční problém ("vaše licence neumožňuje...") místo skutečné příčiny
 * (chybějící seed). Idempotentní a memoizované - seed se za životnost taby
 * spustí jen jednou, opakovaná volání dostanou stejný (vyřešený) příslib.
 */
export function ensureAppBootstrapped(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = ensureDefaultTenantAndLicense().catch((error) => {
      bootstrapPromise = null; // dovolit další pokus (např. po dočasně nedostupné IndexedDB)
      throw error;
    });
  }
  return bootstrapPromise;
}
