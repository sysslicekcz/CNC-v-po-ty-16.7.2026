import { Material } from "@/domain/entities/material";
import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { MaterialRecord, MaterialGroupRecord } from "../records";
import { parseMasterDataStatus } from "./common";

export function materialGroupToRecord(group: MaterialGroup): MaterialGroupRecord {
  return {
    id: group.id,
    tenantId: group.tenantId,
    code: group.code.toString(),
    name: group.name,
    status: group.status,
  };
}

export function materialGroupFromRecord(record: MaterialGroupRecord): MaterialGroup {
  return MaterialGroup.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: MaterialGroupCode.create(record.code),
    name: record.name,
    status: parseMasterDataStatus(record.status),
  });
}

export function materialToRecord(material: Material): MaterialRecord {
  return {
    id: material.id,
    tenantId: material.tenantId,
    code: material.code.toString(),
    name: material.name,
    materialGroupId: material.materialGroupId,
    standard: material.standard,
    designation: material.designation,
    densityKgPerM3: material.densityKgPerM3,
    hardness: material.hardness,
    status: material.status,
    note: material.note,
  };
}

export function materialFromRecord(record: MaterialRecord): Material {
  return Material.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: MaterialCode.create(record.code),
    name: record.name,
    materialGroupId: record.materialGroupId,
    standard: record.standard,
    designation: record.designation,
    densityKgPerM3: record.densityKgPerM3,
    hardness: record.hardness,
    status: parseMasterDataStatus(record.status),
    note: record.note,
  });
}
