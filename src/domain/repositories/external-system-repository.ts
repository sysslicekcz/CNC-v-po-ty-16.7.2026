import { ExternalSystem } from "../integrations/external-system";

/** Tenant-scoped stejně jako MachineRepository/CapacityGroupRepository -
 *  `code` je unikátní jen v rámci `[tenantId, code]`, ne globálně. */
export interface ExternalSystemRepository {
  findById(id: string, tenantId: string): Promise<ExternalSystem | null>;
  findByCode(tenantId: string, code: string): Promise<ExternalSystem | null>;
  list(tenantId: string): Promise<ExternalSystem[]>;
  count(tenantId: string): Promise<number>;
  save(system: ExternalSystem): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
