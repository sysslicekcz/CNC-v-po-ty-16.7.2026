import { Supplier } from "@/domain/entities/supplier";
import { SupplierCode } from "@/domain/value-objects/supplier-code";
import { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateSupplierInput {
  code?: string | null;
  name?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  note?: string;
}

export class UpdateSupplierUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly supplierRepository: SupplierRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateSupplierInput): Promise<Supplier> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    const supplier = await this.supplierRepository.findById(id, tenantId);
    if (!supplier) throw new NotFoundError("Supplier", id);

    if (changes.code !== undefined) {
      if (changes.code === null) {
        supplier.changeCode(undefined);
      } else {
        const newCode = SupplierCode.create(changes.code);
        if (!supplier.code || !newCode.equals(supplier.code)) {
          const conflict = await this.supplierRepository.findByCode(tenantId, newCode);
          if (conflict) throw new MasterDataCodeAlreadyExistsError("Dodavatel", tenantId, newCode.toString());
          supplier.changeCode(newCode);
        }
      }
    }

    if (changes.name !== undefined) supplier.rename(changes.name);
    supplier.updateDetails({
      registrationNumber: changes.registrationNumber,
      email: changes.email,
      phone: changes.phone,
      note: changes.note,
    });

    await this.supplierRepository.save(supplier);
    return supplier;
  }
}
