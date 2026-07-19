import { Tenant } from "@/domain/entities/tenant";
import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { TenantContext } from "@/domain/services/tenant-context";

/** Vrátí aktuálního tenanta podle TenantContext. Za normálních okolností vždy
 *  existuje (viz infrastructure/licensing/seed-default-tenant.ts) - chybějící
 *  tenant znamená poškozená data, ne běžný stav k tichému ošetření. */
export class GetCurrentTenantUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly tenantRepository: TenantRepository
  ) {}

  async execute(): Promise<Tenant> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    const tenant = await this.tenantRepository.findById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant "${tenantId}" neexistuje - chybí výchozí seed (viz ensureDefaultTenantAndLicense).`);
    }
    return tenant;
  }
}
