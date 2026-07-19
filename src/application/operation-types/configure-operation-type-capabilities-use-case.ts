import { OperationTypeCapabilityRequirement, CapabilityRequirementKind } from "@/domain/entities/operation-type-capability-requirement";
import { OperationTypeCapabilityRequirementRepository } from "@/domain/repositories/operation-type-capability-requirement-repository";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { CapabilityTypeRepository } from "@/domain/repositories/capability-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface ConfigureOperationTypeCapabilityInput {
  operationTypeId: string;
  capabilityTypeId: string;
  requirement: CapabilityRequirementKind;
  expectedValue?: string | number | boolean;
}

/** Založí NEBO upraví vazbu "typ operace vyžaduje/doporučuje capabilitu" (Krok 5,
 *  zadání bod 14) - jen správa vazeb, žádný automatický výběr stroje. */
export class ConfigureOperationTypeCapabilitiesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly requirementRepository: OperationTypeCapabilityRequirementRepository,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly capabilityTypeRepository: CapabilityTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: ConfigureOperationTypeCapabilityInput): Promise<OperationTypeCapabilityRequirement> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesManage, "write");

    const operationType = await this.operationTypeRepository.findById(input.operationTypeId, tenantId);
    if (!operationType) throw new NotFoundError("OperationType", input.operationTypeId);
    const capabilityType = await this.capabilityTypeRepository.findById(input.capabilityTypeId, tenantId);
    if (!capabilityType) throw new NotFoundError("CapabilityType", input.capabilityTypeId);

    const existing = (await this.requirementRepository.findByOperationTypeId(input.operationTypeId, tenantId)).find(
      (r) => r.capabilityTypeId === input.capabilityTypeId
    );

    if (existing) {
      existing.setRequirement(input.requirement);
      existing.setExpectedValue(input.expectedValue);
      await this.requirementRepository.save(existing);
      return existing;
    }

    const requirement = OperationTypeCapabilityRequirement.create({
      id: crypto.randomUUID(),
      tenantId,
      operationTypeId: input.operationTypeId,
      capabilityTypeId: input.capabilityTypeId,
      requirement: input.requirement,
      expectedValue: input.expectedValue,
    });
    await this.requirementRepository.save(requirement);
    return requirement;
  }
}
