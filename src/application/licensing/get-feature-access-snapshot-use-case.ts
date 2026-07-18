import { FeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessSnapshot } from "./feature-access-snapshot";

const ALL_FEATURE_CODES: readonly FeatureCode[] = Object.values(FeatureCodes);

/** Sestaví FeatureAccessSnapshot pro aktuálního tenanta (Krok 3.5, bod 27) -
 *  jediné místo, které prochází celý katalog FeatureCode. Chyba při vyhodnocení
 *  licence (neaktivní tenant, vypršelá/pozastavená licence) se nepropaguje jako
 *  výjimka celého use casu - promítne se do `licenseError` a všechny funkce
 *  dostanou "none", aby UI mohlo zobrazit srozumitelný stav místo pádu. */
export class GetFeatureAccessSnapshotUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantRepository: TenantRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<FeatureAccessSnapshot> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    const tenant = await this.tenantRepository.findById(tenantId);

    const access = {} as Record<FeatureCode, FeatureAccess>;
    let licenseError: string | undefined;

    for (const feature of ALL_FEATURE_CODES) {
      try {
        access[feature] = await this.featureAccessService.getAccess(feature);
      } catch (error) {
        access[feature] = "none";
        licenseError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      tenantId,
      tenantActive: tenant?.isActive ?? false,
      access,
      licenseError,
    };
  }
}
