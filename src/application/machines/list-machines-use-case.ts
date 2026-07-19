import { Machine } from "@/domain/entities/machine";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** Read-only licence (`machines.view`) stačí na výpis - `machines.manage` se
 *  vyžaduje jen na zápisové use casy (Krok 5, zadání bod 29). */
export class ListMachinesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<Machine[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesView, "read");
    return this.machineRepository.list(tenantId);
  }
}
