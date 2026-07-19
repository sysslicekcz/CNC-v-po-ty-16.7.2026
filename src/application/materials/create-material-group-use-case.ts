import { MaterialGroup } from "@/domain/entities/material-group";
import { MaterialGroupCode } from "@/domain/value-objects/material-group-code";
import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";

export interface CreateMaterialGroupInput {
  code: string;
  name: string;
}

export class CreateMaterialGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateMaterialGroupInput): Promise<MaterialGroup> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsManage, "write");

    const code = MaterialGroupCode.create(input.code);
    const existing = await this.materialGroupRepository.findByCode(tenantId, code);
    if (existing) throw new MasterDataCodeAlreadyExistsError("Materiálová skupina", tenantId, code.toString());

    const group = MaterialGroup.create({ id: crypto.randomUUID(), tenantId, code, name: input.name, status: "active" });
    await this.materialGroupRepository.save(group);
    return group;
  }
}
