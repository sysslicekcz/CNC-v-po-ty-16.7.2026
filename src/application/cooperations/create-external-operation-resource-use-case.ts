import { ExternalOperationResource } from "@/domain/entities/external-operation-resource";
import { ExternalResourceCode } from "@/domain/value-objects/external-resource-code";
import { ExternalOperationResourceRepository } from "@/domain/repositories/external-operation-resource-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ExternalResourceCodeAlreadyExistsError } from "@/domain/errors/external-resource-code-already-exists-error";

export interface CreateExternalOperationResourceInput {
  code: string;
  name: string;
  supplierId?: string;
  note?: string;
}

/** Založení kooperačního zdroje (Krok 3.5, bod 14) - vlastní funkce
 *  `cooperations.manage`, NENÍ součástí `machines.manage` (kooperace není
 *  Machine, viz docs/adr/0018). */
export class CreateExternalOperationResourceUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly resourceRepository: ExternalOperationResourceRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateExternalOperationResourceInput): Promise<ExternalOperationResource> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CooperationsManage, "write");

    const code = ExternalResourceCode.create(input.code);
    const existing = await this.resourceRepository.findByCode(tenantId, code);
    if (existing) {
      throw new ExternalResourceCodeAlreadyExistsError(tenantId, code.toString());
    }

    const resource = ExternalOperationResource.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      name: input.name,
      supplierId: input.supplierId,
      status: "active",
      note: input.note,
    });
    await this.resourceRepository.save(resource);
    return resource;
  }
}
