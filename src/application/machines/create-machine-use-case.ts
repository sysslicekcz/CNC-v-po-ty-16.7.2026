import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { HourlyRate } from "@/domain/value-objects/hourly-rate";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MachineCodeAlreadyExistsError } from "@/domain/errors/machine-code-already-exists-error";

export interface CreateMachineInput {
  code: string;
  name: string;
  designation?: string;
  maxRpm?: number;
  hourlyRate: HourlyRate;
  note?: string;
}

/** Založení stroje kontroluje licenci (funkce i limit) a unikátnost kódu v
 *  rámci tenanta PŘED zápisem (Krok 3.5, bod 24/22) - unikátní index v
 *  IndexedDB je jen záložní pojistka, ne primární kontrola (viz
 *  IndexedDbMachineRepository). */
export class CreateMachineUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateMachineInput): Promise<Machine> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.MachinesManage, "write");

    const currentCount = await this.machineRepository.count(tenantId);
    await this.featureAccessService.assertWithinLimit("machines.max", currentCount + 1);

    const code = MachineCode.create(input.code);
    const existing = await this.machineRepository.findByCode(tenantId, code);
    if (existing) {
      throw new MachineCodeAlreadyExistsError(tenantId, code.toString());
    }

    const machine = Machine.create({
      id: crypto.randomUUID(),
      tenantId,
      code,
      name: input.name,
      designation: input.designation,
      maxRpm: input.maxRpm,
      hourlyRate: input.hourlyRate,
      status: "active",
      note: input.note,
    });
    await this.machineRepository.save(machine);
    return machine;
  }
}
