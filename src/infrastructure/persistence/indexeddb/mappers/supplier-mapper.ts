import { Supplier } from "@/domain/entities/supplier";
import { SupplierCode } from "@/domain/value-objects/supplier-code";
import { SupplierRecord } from "../records";
import { parseMasterDataStatus } from "./common";

export function supplierToRecord(supplier: Supplier): SupplierRecord {
  return {
    id: supplier.id,
    tenantId: supplier.tenantId,
    code: supplier.code?.toString(),
    name: supplier.name,
    registrationNumber: supplier.registrationNumber,
    email: supplier.email,
    phone: supplier.phone,
    status: supplier.status,
    note: supplier.note,
  };
}

export function supplierFromRecord(record: SupplierRecord): Supplier {
  return Supplier.restore({
    id: record.id,
    tenantId: record.tenantId,
    code: record.code ? SupplierCode.create(record.code) : undefined,
    name: record.name,
    registrationNumber: record.registrationNumber,
    email: record.email,
    phone: record.phone,
    status: parseMasterDataStatus(record.status),
    note: record.note,
  });
}
