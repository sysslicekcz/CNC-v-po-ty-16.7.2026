import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MachineCodeAlreadyExistsError } from "@/domain/errors/machine-code-already-exists-error";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateMachineInput {
  name?: string;
  code?: string;
  hourlyRate?: HourlyRate;
}

/** Přejmenování/změna kódu NIKDY nemění `Machine.id` a nesahá na historické
 *  CalculationSnapshot (ty jsou zamrzlé kopie z okamžiku výpočtu, viz
 *  domain/aggregates/routing-sheet/types.ts) - existující Operation.machineId
 *  odkazy zůstávají platné (Krok 3.5, bod 24). Změna kódu se znovu ověřuje
 *  proti unikátnosti v rámci tenanta stejně jako při založení. */
export class UpdateMachineUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(machineId: string, changes: UpdateMachineInput): Promise<Machine> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const machine = await this.machineRepository.findById(machineId, tenantId);
    if (!machine) {
      throw new NotFoundError("Machine", machineId);
    }

    if (changes.code !== undefined) {
      const newCode = MachineCode.create(changes.code);
      if (!newCode.equals(machine.code)) {
        const conflict = await this.machineRepository.findByCode(tenantId, newCode);
        if (conflict) {
          throw new MachineCodeAlreadyExistsError(tenantId, newCode.toString());
        }
        machine.changeCode(newCode);
      }
    }

    if (changes.name !== undefined) {
      machine.rename(changes.name);
    }

    if (changes.hourlyRate !== undefined) {
      machine.setHourlyRate(changes.hourlyRate);
    }

    await this.machineRepository.save(machine);
    return machine;
  }
}
