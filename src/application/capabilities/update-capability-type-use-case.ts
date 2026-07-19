import { CapabilityType } from "@/domain/entities/capability-type";
import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateCapabilityTypeInput {
  name?: string;
  unit?: string;
  allowedValues?: string[];
  status?: "active" | "inactive";
}

export class UpdateCapabilityTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capabilityTypeRepository: CapabilityTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateCapabilityTypeInput): Promise<CapabilityType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const capabilityType = await this.capabilityTypeRepository.findById(id, tenantId);
    if (!capabilityType) throw new NotFoundError("CapabilityType", id);

    if (changes.name !== undefined) capabilityType.rename(changes.name);
    capabilityType.updateDetails({ unit: changes.unit, allowedValues: changes.allowedValues });
    if (changes.status !== undefined) capabilityType.setStatus(changes.status);

    await this.capabilityTypeRepository.save(capabilityType);
    return capabilityType;
  }
}
