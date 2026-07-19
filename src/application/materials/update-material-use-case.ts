import { Material } from "@/domain/entities/material";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateMaterialInput {
  name?: string;
  materialGroupId?: string;
  standard?: string;
  designation?: string;
  densityKgPerM3?: number;
  hardness?: number;
  note?: string;
}

export class UpdateMaterialUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialRepository: MaterialRepository,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateMaterialInput): Promise<Material> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsManage, "write");

    const material = await this.materialRepository.findById(id, tenantId);
    if (!material) throw new NotFoundError("Material", id);

    if (changes.materialGroupId !== undefined) {
      const group = await this.materialGroupRepository.findById(changes.materialGroupId, tenantId);
      if (!group) throw new NotFoundError("MaterialGroup", changes.materialGroupId);
    }

    if (changes.name !== undefined) material.rename(changes.name);
    material.updateDetails({
      materialGroupId: changes.materialGroupId,
      standard: changes.standard,
      designation: changes.designation,
      densityKgPerM3: changes.densityKgPerM3,
      hardness: changes.hardness,
      note: changes.note,
    });

    await this.materialRepository.save(material);
    return material;
  }
}
