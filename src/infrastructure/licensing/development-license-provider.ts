import { LicenseProvider } from "@/domain/licensing/license-provider";
import { License } from "@/domain/licensing/license";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/**
 * Dekorátor nad libovolným LicenseProvider (Krok 3.5, bod 25) - JEN ve
 * vývojovém prostředí rozšíří licenci na plný přístup ke všem FeatureCode
 * (usnadní lokální vývoj/testování ještě nelicencovaných modulů). Mimo
 * vývojové prostředí se bezpečně chová jako průhledný passthrough na
 * `fallback` - produkce nikdy nedostane rozšířený přístup jen proto, že se
 * tahle třída omylem dostala do produkčního zapojení (docs/adr/0022).
 *
 * `isDevelopmentEnv` jde přepsat kvůli testovatelnosti (výchozí čte
 * `process.env.NODE_ENV`), produkční zapojení ho nikdy nepřepisuje.
 */
export class DevelopmentLicenseProvider implements LicenseProvider {
  constructor(
    private readonly fallback: LicenseProvider,
    private readonly isDevelopmentEnv: () => boolean = () => process.env.NODE_ENV === "development"
  ) {}

  async getCurrentLicense(): Promise<License> {
    const base = await this.fallback.getCurrentLicense();
    if (!this.isDevelopmentEnv()) {
      return base;
    }
    return License.create({
      id: base.id,
      tenantId: base.tenantId,
      planCode: base.planCode,
      status: base.status,
      validFrom: base.validFrom,
      validUntil: base.validUntil,
      features: Object.values(FeatureCodes).map((code) => ({ code, access: "full" as const })),
      limits: [...base.limits],
      issuedAt: base.issuedAt,
      updatedAt: base.updatedAt,
      validation: base.validation,
    });
  }
}
