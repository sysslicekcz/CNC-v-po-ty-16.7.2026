import { ExternalSystem, ExternalSystemType, ExternalSystemStatus } from "@/domain/integrations/external-system";
import { ExternalSystemRecord } from "../records";
import { parseEntityStavLike } from "./common";

const TYPE_VALUES = [
  "erp",
  "mes",
  "accounting",
  "planning",
  "custom",
  "file_exchange",
] as const satisfies readonly ExternalSystemType[];
const STATUS_VALUES = ["active", "inactive"] as const satisfies readonly ExternalSystemStatus[];

export function externalSystemToRecord(system: ExternalSystem): ExternalSystemRecord {
  return {
    id: system.id,
    tenantId: system.tenantId,
    code: system.code,
    name: system.name,
    type: system.type,
    connectorType: system.connectorType,
    status: system.status,
  };
}

export function externalSystemFromRecord(record: ExternalSystemRecord): ExternalSystem {
  return ExternalSystem.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: record.code,
    name: record.name,
    type: parseEntityStavLike(record.type, TYPE_VALUES, "ExternalSystem.type"),
    connectorType: record.connectorType,
    status: parseEntityStavLike(record.status, STATUS_VALUES, "ExternalSystem.status"),
  });
}
