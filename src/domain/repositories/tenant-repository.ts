import { Tenant } from "../entities/tenant";
import { TenantCode } from "../value-objects/tenant-code";

/** Tenant je globální (nepatří sám sobě tenantovi - je to entita, kterou by
 *  ostatní tenant-aware repozitáře scopovaly). Vlastní jednoduchý agregát. */
export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>;
  findByCode(code: TenantCode): Promise<Tenant | null>;
  findAll(): Promise<Tenant[]>;
  save(tenant: Tenant): Promise<void>;
  delete(id: string): Promise<void>;
}
