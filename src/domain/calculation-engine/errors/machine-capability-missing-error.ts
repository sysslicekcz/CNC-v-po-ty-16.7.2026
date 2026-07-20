import { DomainError } from "@/domain/errors/domain-error";

/**
 * Stroji chybí funkce/schopnost vyžadovaná operací (AP-MCE-001 Fáze B §3/§14).
 * `MachineProfile.assertWithinLimits` sama o sobě chybějící funkci hlásí jen
 * jako nezávazný `CalculationIssue` (`severity: "warning"` - AP-MCE-001 §18
 * chybějící funkci neřadí mezi blokující), tahle chyba je pro kontexty, kde
 * je chybějící schopnost NUTNÉ vynutit jako blokující (např. `Compare
 * MachineProfilesUseCase` při explicitním požadavku "jen stroje se schopností
 * X" - viz `MachineProfile.requireFunction`).
 */
export class MachineCapabilityMissingError extends DomainError {
  constructor(readonly machineProfileId: string, readonly capabilityCode: string) {
    super(`MachineProfile "${machineProfileId}" nemá požadovanou schopnost/funkci "${capabilityCode}".`);
  }
}
