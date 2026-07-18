import { Tenant } from "@/domain/entities/tenant";
import { TenantCode } from "@/domain/value-objects/tenant-code";
import { TenantRecord } from "../records";
import { parseEntityStavLike } from "./common";

const TENANT_STATUS_VALUES = ["active", "trial", "suspended", "inactive"] as const;

export function tenantToRecord(tenant: Tenant): TenantRecord {
  return {
    id: tenant.id,
    code: tenant.code.toString(),
    name: tenant.name,
    status: tenant.status,
  };
}

export function tenantFromRecord(record: TenantRecord): Tenant {
  return Tenant.restore({
    id: record.id,
    code: TenantCode.create(record.code),
    name: record.name,
    status: parseEntityStavLike(record.status, TENANT_STATUS_VALUES, "Tenant.status"),
  });
}
