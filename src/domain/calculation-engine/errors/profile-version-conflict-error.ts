import { DomainError } from "@/domain/errors/domain-error";

/**
 * Optimistický konflikt verzí (AP-MCE-001 Fáze B §14) - `UpdateMaterial
 * ProfileUseCase`/`UpdateMachineProfileUseCase`/`UpdateToolProfileUseCase`
 * (§11) ji vyhodí, když `expectedVersion` předaný volajícím neodpovídá
 * aktuálnímu `recordVersion` v repozitáři (někdo jiný profil mezitím změnil).
 */
export class ProfileVersionConflictError extends DomainError {
  constructor(readonly profileId: string, readonly expectedVersion: number, readonly actualVersion: number) {
    super(
      `Profil "${profileId}" byl mezitím změněn (očekávaná verze ${expectedVersion}, aktuální ${actualVersion}) - načtěte ho znovu.`
    );
  }
}
