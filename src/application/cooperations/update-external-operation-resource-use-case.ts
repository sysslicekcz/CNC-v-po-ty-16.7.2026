import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { Money } from "@/domain/value-objects/money";
import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ExternalResourceCodeAlreadyExistsError } from "@/domain/errors/external-resource-code-already-exists-error";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateExternalOperationResourceInput {
  code?: string;
  name?: string;
  supplierId?: string;
  supportedOperationTypeIds?: string[];
  defaultLeadTimeDays?: number;
  defaultCost?: Money;
  note?: string;
}

export class UpdateExternalOperationResourceUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resourceRepository: ExternalOperationResourceRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateExternalOperationResourceInput): Promise<ExternalOperationResource> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    const resource = await this.resourceRepository.findById(id, tenantId);
    if (!resource) throw new NotFoundError("ExternalOperationResource", id);

    if (changes.code !== undefined) {
      const newCode = ExternalResourceCode.create(changes.code);
      if (!newCode.equals(resource.code)) {
        const conflict = await this.resourceRepository.findByCode(tenantId, newCode);
        if (conflict) throw new ExternalResourceCodeAlreadyExistsError(tenantId, newCode.toString());
        resource.changeCode(newCode);
      }
    }

    if (changes.name !== undefined) resource.rename(changes.name);

    resource.updateDetails({
      supplierId: changes.supplierId,
      supportedOperationTypeIds: changes.supportedOperationTypeIds,
      defaultLeadTimeDays: changes.defaultLeadTimeDays,
      defaultCost: changes.defaultCost,
      note: changes.note,
    });

    await this.resourceRepository.save(resource);
    return resource;
  }
}
