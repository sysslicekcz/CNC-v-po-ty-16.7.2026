import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { MachineProfile } from "@/domain/calculation-engine/profiles/machine-profile";
import { MachineCorrection } from "@/domain/calculation-engine/profiles/machine-correction";
import { resolveMachineProfileOverlay } from "@/domain/calculation-engine/profiles/machine-profile-overlay";
import { MachineProfileSnapshot } from "@/domain/calculation-engine/profiles/machine-profile-snapshot";
import { MachineProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";

export interface ResolvedMachineProfile {
  resolved: MachineProfile;
  system: MachineProfile;
  correction?: MachineCorrection;
}

/** `MachineProfileResolver` (AP-MCE-001 Fáze B §6) - viz `MaterialProfile
 *  Resolver` pro plné zdůvodnění vzoru (Application vrstva, jediné místo, kde
 *  se repozitář a čistý overlay spojují). */
export class MachineProfileResolver {
  constructor(private readonly repository: MachineProfileRepository) {}

  async resolve(machineProfileId: string, tenantId: string): Promise<ResolvedMachineProfile> {
    const system = await this.repository.getById(machineProfileId, tenantId);
    if (!system) throw new MachineProfileNotFoundError(machineProfileId, tenantId);

    const correction = await this.repository.findCorrectionByProfileId(machineProfileId, tenantId);
    const resolved = resolveMachineProfileOverlay(system, correction ?? undefined);
    return { resolved, system, correction: correction ?? undefined };
  }

  async resolveSnapshot(machineProfileId: string, tenantId: string, createdAt: string): Promise<MachineProfileSnapshot> {
    const { resolved, system, correction } = await this.resolve(machineProfileId, tenantId);
    return MachineProfileSnapshot.forMachineProfile(resolved, {
      systemVersion: system.recordVersion,
      correctionVersion: correction?.recordVersion,
      createdAt,
    });
  }

  /** AP-MCE-001 Fáze B §3 "porovnat jednu operaci napříč více stroji" -
   *  resolvuje víc strojů najednou, každý nezávisle (jedno selhání jednoho
   *  `machineProfileId` neshodí zbytek dávky - volající dostane `Promise.
   *  allSettled`-like rozlišení sám podle toho, co potřebuje). */
  async resolveMany(machineProfileIds: readonly string[], tenantId: string): Promise<ResolvedMachineProfile[]> {
    return Promise.all(machineProfileIds.map((id) => this.resolve(id, tenantId)));
  }
}
