import { Supplier } from "@/domain/entities/supplier";
import { SupplierCode } from "@/domain/value-objects/supplier-code";
import { SupplierRepository } from "@/domain/repositories/supplier-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";

export interface CreateSupplierInput {
  code?: string;
  name: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  note?: string;
}

/** Dodavatel patří pod správu kooperací (`cooperations.manage`) - je to
 *  minimální podpůrný číselník pro `ExternalOperationResource.supplierId`,
 *  ne vlastní licencovaný modul (Krok 5, zadání bod 16). */
export class CreateSupplierUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly supplierRepository: SupplierRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateSupplierInput): Promise<Supplier> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    let code: SupplierCode | undefined;
    if (input.code) {
      code = SupplierCode.create(input.code);
      const existing = await this.supplierRepository.findByCode(tenantId, code);
      if (existing) throw new MasterDataCodeAlreadyExistsError("Dodavatel", tenantId, code.toString());
    }

    const supplier = Supplier.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      name: input.name,
      registrationNumber: input.registrationNumber,
      email: input.email,
      phone: input.phone,
      status: "active",
      note: input.note,
    });
    await this.supplierRepository.save(supplier);
    return supplier;
  }
}
