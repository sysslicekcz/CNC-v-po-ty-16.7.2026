import { Machine } from "@/domain/entities/machine";
import { MachineCode } from "@/domain/value-objects/machine-code";
import { MachineRepository } from "@/domain/repositories/machine-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { UnknownMachineCodeError } from "@/domain/errors/unknown-machine-code-error";

/** Najde stroj podle uživatelského/podnikového kódu (Krok 3.5, bod 16) - NIKDY
 *  automaticky nevytvoří nový stroj, pokud kód neexistuje (viz docs/adr/0016) -
 *  neznámý kód je integrační problém k ručnímu vyřešení, ne důvod tiše založit
 *  nový záznam. */
export class ResolveMachineByCodeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly machineRepository: MachineRepository
  ) {}

  async execute(code: string): Promise<Machine> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    const machineCode = MachineCode.create(code);
    const machine = await this.machineRepository.findByCode(tenantId, machineCode);
    if (!machine) {
      throw new UnknownMachineCodeError(tenantId, machineCode.toString());
    }
    return machine;
  }
}
