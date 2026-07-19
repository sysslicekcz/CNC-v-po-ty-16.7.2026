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
 * Licence odpovídá tomu, co appka DNES fakticky umí - ne budoucím modulům,
 * které appka ještě nemá v UI (plánování, pokročilé kalkulace, import/export/
 * synchronizace s konkrétním ERP): ty licence záměrně neuvádí, takže
 * FeatureAccessService pro ně vrátí "none", dokud nebudou skutečně
 * implementované a licenčně zpřístupněné.
 * `routing.release`/`cooperations.view` byly doplněny v Kroku 4. Krok 5
 * (správa kmenových dat) doplňuje `machines.capacity_groups`,
 * `cooperations.manage`, `operation_types.*`, `cutting_conditions.*`,
 * `materials.*` - bez nich by čerstvá instalace appky nemohla použít žádnou z
 * nově postavených obrazovek `/tpv/master-data/*`, viz docs/audits/step-5-audit.md.
 * Krok 6 (integrace/UX dotažení) doplňuje `integration.erp.view`/`.configure` -
 * appka teď má skutečnou stránku `/tpv/integrations` pro evidenci připojených
 * externích systémů.
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
          { code: FeatureCodes.RoutingRelease, access: "full" },
          { code: FeatureCodes.CalculationsBasic, access: "full" },
          { code: FeatureCodes.MachinesView, access: "full" },
          { code: FeatureCodes.MachinesManage, access: "full" },
          { code: FeatureCodes.MachinesCapacityGroups, access: "full" },
          { code: FeatureCodes.ToolsView, access: "full" },
          { code: FeatureCodes.ToolsManage, access: "full" },
          { code: FeatureCodes.CooperationsView, access: "full" },
          { code: FeatureCodes.CooperationsManage, access: "full" },
          { code: FeatureCodes.OperationTypesView, access: "full" },
          { code: FeatureCodes.OperationTypesManage, access: "full" },
          { code: FeatureCodes.CuttingConditionsView, access: "full" },
          { code: FeatureCodes.CuttingConditionsManage, access: "full" },
          { code: FeatureCodes.MaterialsView, access: "full" },
          { code: FeatureCodes.MaterialsManage, access: "full" },
          { code: FeatureCodes.IntegrationErpView, access: "full" },
          { code: FeatureCodes.IntegrationErpConfigure, access: "full" },
        ],
        limits: [],
        issuedAt: new Date().toISOString(),
      })
    );
  }
}
