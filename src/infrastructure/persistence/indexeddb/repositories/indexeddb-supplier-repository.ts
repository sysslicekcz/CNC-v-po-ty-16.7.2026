import { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { Supplier } from "@/domain/entities/supplier";
import { SupplierCode } from "@/domain/value-objects/supplier-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { SupplierRecord } from "../records";
import { supplierToRecord, supplierFromRecord } from "../mappers/supplier-mapper";
import { tpvGetAllByIndex, tpvGet, tpvPut, tpvDelete } from "../tpv-db";

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "ConstraintError";
}

export class IndexedDbSupplierRepository implements SupplierRepository {
  async findById(id: string, tenantId: string): Promise<Supplier | null> {
    const record = await tpvGet<SupplierRecord>("tpvSuppliers", id);
    if (!record || record.tenantId !== tenantId) return null;
    return supplierFromRecord(record);
  }

  async findByCode(tenantId: string, code: SupplierCode): Promise<Supplier | null> {
    const records = await tpvGetAllByIndex<SupplierRecord>("tpvSuppliers", "tenantId", tenantId);
    const match = records.find((r) => r.code === code.toString());
    return match ? supplierFromRecord(match) : null;
  }

  async list(tenantId: string): Promise<Supplier[]> {
    const records = await tpvGetAllByIndex<SupplierRecord>("tpvSuppliers", "tenantId", tenantId);
    return records.map(supplierFromRecord);
  }

  async save(supplier: Supplier): Promise<void> {
    try {
      await tpvPut("tpvSuppliers", supplierToRecord(supplier));
    } catch (error) {
      if (isConstraintError(error) && supplier.code) {
        throw new MasterDataCodeAlreadyExistsError("Dodavatel", supplier.tenantId, supplier.code.toString());
      }
      throw error;
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await tpvGet<SupplierRecord>("tpvSuppliers", id);
    if (!existing || existing.tenantId !== tenantId) return;
    await tpvDelete("tpvSuppliers", id);
  }
}
