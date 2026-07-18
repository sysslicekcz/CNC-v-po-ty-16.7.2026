import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License } from "@/domain/licensing/license";
import { LicenseRepository } from "@/domain/repositories/license-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { LicenseUnavailableError } from "@/domain/errors/license-errors";

/** Základní implementace LicenseProvider (Krok 3.5, bod 25) - čte uloženou
 *  licenci aktuálního tenanta. Pokud licence chybí (mělo by nastat jen při
 *  poškozených datech - seed vytváří výchozí licenci vždy), selže bezpečně
 *  s LicenseUnavailableError místo tichého přiznání plného přístupu. */
export class LocalLicenseProvider implements LicenseProvider {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly licenseRepository: LicenseRepository
  ) {}

  async getCurrentLicense(): Promise<License> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    const license = await this.licenseRepository.findByTenantId(tenantId);
    if (!license) {
      throw new LicenseUnavailableError(tenantId);
    }
    return license;
  }
}
