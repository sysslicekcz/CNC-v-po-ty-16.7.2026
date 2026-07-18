import { TenantContext } from "@/domain/services/tenant-context";
import { DEFAULT_TENANT_ID } from "@/domain/entities/tenant";

/** Jediná implementace TenantContext pro dnešní jednouživatelský/offline provoz
 *  (Krok 3.5, bod 10) - vždy vrací výchozí lokální tenant, žádné přihlašování
 *  ani výběr organizace. Budoucí server/cloud varianta (jiná implementace
 *  stejného portu) bude odvozovat tenantId ze session/auth kontextu. */
export class LocalTenantContext implements TenantContext {
  getCurrentTenantId(): string | null {
    return DEFAULT_TENANT_ID;
  }

  requireCurrentTenantId(): string {
    return DEFAULT_TENANT_ID;
  }
}
