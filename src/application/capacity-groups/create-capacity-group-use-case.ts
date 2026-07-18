import { CapacityGroup } from "@/domain/entities/capacity-group";
import { CapacityGroupCode } from "@/domain/value-objects/capacity-group-code";
import { CapacityGroupRepository } from "@/domain/repositories/capacity-group-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { CapacityGroupCodeAlreadyExistsError } from "@/domain/errors/capacity-group-code-already-exists-error";

export interface CreateCapacityGroupInput {
  code: string;
  name: string;
  note?: string;
}

/** Založení skupiny sdílené kapacity (Krok 3.5, bod 13) - vyžaduje samostatnou
 *  funkci `machines.capacity_groups`, ne jen obecnou správu strojů. */
export class CreateCapacityGroupUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly capacityGroupRepository: CapacityGroupRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateCapacityGroupInput): Promise<CapacityGroup> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesCapacityGroups, "write");

    const code = CapacityGroupCode.create(input.code);
    const existing = await this.capacityGroupRepository.findByCode(tenantId, code);
    if (existing) {
      throw new CapacityGroupCodeAlreadyExistsError(tenantId, code.toString());
    }

    const group = CapacityGroup.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      name: input.name,
      status: "active",
      note: input.note,
    });
    await this.capacityGroupRepository.save(group);
    return group;
  }
}
