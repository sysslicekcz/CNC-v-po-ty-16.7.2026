import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { LicenseFeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess, satisfiesAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { License } from "@/domain/licensing/license";
import { LicenseProvider } from "@/domain/licensing/license-provider";
import { TenantContext } from "@/domain/services/tenant-context";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import {
  FeatureNotLicensedError,
  LicenseExpiredError,
  LicenseSuspendedError,
  ReadOnlyLicenseError,
  LicenseLimitExceededError,
  TenantNotActiveError,
} from "@/domain/errors/license-errors";

/**
 * Jediná implementace FeatureAccessService (Krok 3.5, bod 24) - ověřuje
 * aktivního tenanta, stav/platnost licence (vč. grace period), požadovanou
 * funkci a limit. Použitelná z libovolného use casu bez ohledu na to, odkud
 * TenantContext/LicenseProvider pocházejí (docs/adr/0021).
 */
export class DefaultFeatureAccessService implements FeatureAccessService {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantRepository: TenantRepository,
    private readonly licenseProvider: LicenseProvider
  ) {}

  async getAccess(feature: LicenseFeatureCode): Promise<FeatureAccess> {
    const license = await this.resolveActiveLicense();
    return license.getFeatureAccess(feature) ?? "none";
  }

  async canUse(feature: LicenseFeatureCode, requiredAccess: FeatureAccess = "read"): Promise<boolean> {
    try {
      await this.require(feature, requiredAccess);
      return true;
    } catch {
      return false;
    }
  }

  async require(feature: LicenseFeatureCode, requiredAccess: FeatureAccess = "read"): Promise<void> {
    const access = await this.getAccess(feature);
    if (access === "none") {
      throw new FeatureNotLicensedError(feature);
    }
    if (!satisfiesAccess(access, requiredAccess)) {
      throw new ReadOnlyLicenseError(feature);
    }
  }

  async getLimit(limitCode: LicenseLimitCode): Promise<number | null> {
    const license = await this.resolveActiveLicense();
    return license.getLimit(limitCode) ?? null;
  }

  async assertWithinLimit(limitCode: LicenseLimitCode, nextValue: number): Promise<void> {
    const limit = await this.getLimit(limitCode);
    if (limit === null) return; // bez uvedeného limitu = neomezeno
    if (nextValue > limit) {
      throw new LicenseLimitExceededError(limitCode, limit, nextValue);
    }
  }

  private async resolveActiveLicense(): Promise<License> {
    const tenantId = this.tenantContext.requireCurrentTenantId();

    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant || !tenant.isActive) {
      throw new TenantNotActiveError(tenantId);
    }

    const license = await this.licenseProvider.getCurrentLicense();

    if (license.status === "suspended") {
      throw new LicenseSuspendedError(tenantId);
    }

    const now = new Date();
    const inGracePeriod =
      license.validation?.status === "grace_period" &&
      !!license.validation.gracePeriodUntil &&
      new Date(license.validation.gracePeriodUntil).getTime() > now.getTime();

    if (license.status === "expired" || license.status === "cancelled") {
      if (!inGracePeriod) throw new LicenseExpiredError(tenantId);
    } else if (!license.isWithinValidityPeriod(now) && !inGracePeriod) {
      throw new LicenseExpiredError(tenantId);
    }

    return license;
  }
}
