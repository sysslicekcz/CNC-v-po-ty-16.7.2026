import { CapacityGroup, CapacityGroupStatus } from "@/domain/entities/capacity-group";
import { CapacityGroupCode } from "@/domain/value-objects/capacity-group-code";
import { CapacityGroupRecord } from "../records";
import { parseEntityStavLike } from "./common";

const STATUS_VALUES = ["active", "inactive"] as const satisfies readonly CapacityGroupStatus[];

export function capacityGroupToRecord(group: CapacityGroup): CapacityGroupRecord {
  return {
    id: group.id,
    tenantId: group.tenantId,
    code: group.code.toString(),
    name: group.name,
    status: group.status,
    note: group.note,
  };
}

export function capacityGroupFromRecord(record: CapacityGroupRecord): CapacityGroup {
  return CapacityGroup.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: CapacityGroupCode.create(record.code),
    name: record.name,
    status: parseEntityStavLike(record.status, STATUS_VALUES, "CapacityGroup.status"),
    note: record.note,
  });
}
