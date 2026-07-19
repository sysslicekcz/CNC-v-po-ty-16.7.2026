import { TenantRepository } from "@/domain/repositories/tenant-repository";
import { Tenant } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { TenantRecord } from "../records";
import { tenantToRecord, tenantFromRecord } from "../mappers/tenant-mapper";
import { tpvGetAll, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

/** Tenant je globální (viz TenantRepository) - žádné tenantId scopování zde,
 *  na rozdíl od Machine/CapacityGroup/ExternalOperationResource. */
export class IndexedDbTenantRepository implements TenantRepository {
  async findById(id: string): Promise<Tenant | null> {
    const record = await tpvGet<TenantRecord>("tpvTenants", id);
    return record ? tenantFromRecord(record) : null;
  }

  async findByCode(code: TenantCode): Promise<Tenant | null> {
    const all = await tpvGetAll<TenantRecord>("tpvTenants");
    const match = all.find((r) => r.code === code.toString());
    return match ? tenantFromRecord(match) : null;
  }

  async findAll(): Promise<Tenant[]> {
    const records = await tpvGetAll<TenantRecord>("tpvTenants");
    return records.map(tenantFromRecord);
  }

  async save(tenant: Tenant): Promise<void> {
    await tpvPut("tpvTenants", tenantToRecord(tenant));
  }

  async delete(id: string): Promise<void> {
    await tpvDelete("tpvTenants", id);
  }
}
