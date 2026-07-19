import { CapabilityType, CapabilityValueType } from "@/domain/entities/capability-type";
import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";

export interface CreateCapabilityTypeInput {
  code: string;
  name: string;
  valueType: CapabilityValueType;
  unit?: string;
  allowedValues?: string[];
}

export class CreateCapabilityTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capabilityTypeRepository: CapabilityTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateCapabilityTypeInput): Promise<CapabilityType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const existing = await this.capabilityTypeRepository.findByCode(tenantId, input.code);
    if (existing) throw new MasterDataCodeAlreadyExistsError("Typ capability", tenantId, input.code);

    const capabilityType = CapabilityType.create({
      id: crypto.randomUUID(),
      tenantId,
      code: input.code,
      name: input.name,
      valueType: input.valueType,
      unit: input.unit,
      allowedValues: input.allowedValues,
      status: "active",
    });
    await this.capabilityTypeRepository.save(capabilityType);
    return capabilityType;
  }
}
