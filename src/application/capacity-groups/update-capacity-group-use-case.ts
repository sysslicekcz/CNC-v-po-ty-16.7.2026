import { CapacityGroup } from "@/domain/entities/capacity-group";
import { CapacityGroupCode } from "@/domain/value-objects/capacity-group-code";
import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { CapacityGroupCodeAlreadyExistsError } from "@/domain/errors/capacity-group-code-already-exists-error";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateCapacityGroupInput {
  name?: string;
  code?: string;
  note?: string;
}

export class UpdateCapacityGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateCapacityGroupInput): Promise<CapacityGroup> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesCapacityGroups, "write");

    const group = await this.capacityGroupRepository.findById(id, tenantId);
    if (!group) throw new NotFoundError("CapacityGroup", id);

    if (changes.code !== undefined) {
      const newCode = CapacityGroupCode.create(changes.code);
      if (!newCode.equals(group.code)) {
        const conflict = await this.capacityGroupRepository.findByCode(tenantId, newCode);
        if (conflict) throw new CapacityGroupCodeAlreadyExistsError(tenantId, newCode.toString());
        group.changeCode(newCode);
      }
    }

    if (changes.name !== undefined) group.rename(changes.name);
    if (changes.note !== undefined) group.setNote(changes.note);

    await this.capacityGroupRepository.save(group);
    return group;
  }
}
