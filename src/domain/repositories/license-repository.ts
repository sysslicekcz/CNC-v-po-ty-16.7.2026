import { License } from "../licensing/license";

/** Čistě persistence - "co je uložené". Efektivní aktuální licenci pro použití
 *  v Application vrstvě dodává LicenseProvider (viz domain/licensing/license-provider.ts),
 *  ne tenhle repozitář přímo (docs/adr/0021). */
export interface LicenseRepository {
  findByTenantId(tenantId: string): Promise<License | null>;
  save(license: License): Promise<void>;
}
