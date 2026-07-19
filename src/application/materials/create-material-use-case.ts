import { Material } from "@/domain/entities/material";
import { MaterialCode } from "@/domain/value-objects/material-code";
import { MaterialRepository } from "@/domain/repositories/material-repository";
import { MaterialGroupRepository } from "@/domain/repositories/material-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface CreateMaterialInput {
  code: string;
  name: string;
  materialGroupId: string;
  standard?: string;
  designation?: string;
  densityKgPerM3?: number;
  hardness?: number;
  note?: string;
}

export class CreateMaterialUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly materialRepository: MaterialRepository,
    private readonly materialGroupRepository: MaterialGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateMaterialInput): Promise<Material> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MaterialsManage, "write");

    const group = await this.materialGroupRepository.findById(input.materialGroupId, tenantId);
    if (!group) throw new NotFoundError("MaterialGroup", input.materialGroupId);

    const code = MaterialCode.create(input.code);
    const existing = await this.materialRepository.findByCode(tenantId, code);
    if (existing) throw new MasterDataCodeAlreadyExistsError("Materiál", tenantId, code.toString());

    const material = Material.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      name: input.name,
      materialGroupId: input.materialGroupId,
      standard: input.standard,
      designation: input.designation,
      densityKgPerM3: input.densityKgPerM3,
      hardness: input.hardness,
      status: "active",
      note: input.note,
    });
    await this.materialRepository.save(material);
    return material;
  }
}
