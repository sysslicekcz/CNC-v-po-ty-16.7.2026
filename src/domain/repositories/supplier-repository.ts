import { Supplier } from "../entities/supplier";
import { SupplierCode } from "../value-objects/supplier-code";

export interface SupplierRepository {
  findById(id: string, tenantId: string): Promise<Supplier | null>;
  findByCode(tenantId: string, code: SupplierCode): Promise<Supplier | null>;
  list(tenantId: string): Promise<Supplier[]>;
  save(supplier: Supplier): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
