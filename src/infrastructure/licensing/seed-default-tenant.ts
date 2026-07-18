import { Tenant, DEFAULT_TENANT_ID } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { License } from "@/domain/licensing/license";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { IndexedDbTenantRepository } from "../persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { IndexedDbLicenseRepository } from "../persistence/indexeddb/repositories/indexeddb-license-repository";

const DEFAULT_TENANT_CODE = "LOCAL-DEFAULT";
const DEFAULT_LICENSE_ID = "license:local-default";
const DEFAULT_LICENSE_PLAN_CODE = "local-default";

/**
 * Idempotentní seed výchozího lokálního tenanta a jeho licence (Krok 3.5,
 * bod 26/10) - read-before-write, nic nemaže ani nepřepisuje existující
 * odlišný stav (např. ručně pozastavený tenant zůstane pozastavený).
 *
 * Licence odpovídá tomu, co appka DNES fakticky umí (prohlížení/editace
 * postupů, základní kalkulace, správa strojů a nástrojů) - ne budoucím
 * modulům, které appka ještě nemá v UI (plánování, Helios integrace,
 * kooperace, capacity groups): ty licence záměrně neuvádí, takže
 * FeatureAccessService pro ně vrátí "none", dokud nebudou skutečně
 * implementované a licenčně zpřístupněné.
 */
export async function ensureDefaultTenantAndLicense(): Promise<void> {
  const tenants = new IndexedDbTenantRepository();
  const licenses = new IndexedDbLicenseRepository();

  const existingTenant = await tenants.findById(DEFAULT_TENANT_ID);
  if (!existingTenant) {
    await tenants.save(
      Tenant.create({
        id: DEFAULT_TENANT_ID,
        code: TenantCode.create(DEFAULT_TENANT_CODE),
        name: "Lokální organizace",
        status: "active",
      })
    );
  }

  const existingLicense = await licenses.findByTenantId(DEFAULT_TENANT_ID);
  if (!existingLicense) {
    await licenses.save(
      License.create({
        id: DEFAULT_LICENSE_ID,
        tenantId: DEFAULT_TENANT_ID,
        planCode: DEFAULT_LICENSE_PLAN_CODE,
        status: "active",
        validFrom: new Date(0).toISOString(),
        features: [
          { code: FeatureCodes.RoutingView, access: "full" },
          { code: FeatureCodes.RoutingEdit, access: "full" },
          { code: FeatureCodes.CalculationsBasic, access: "full" },
          { code: FeatureCodes.MachinesView, access: "full" },
          { code: FeatureCodes.MachinesManage, access: "full" },
          { code: FeatureCodes.ToolsView, access: "full" },
          { code: FeatureCodes.ToolsManage, access: "full" },
        ],
        limits: [],
        issuedAt: new Date().toISOString(),
      })
    );
  }
}
