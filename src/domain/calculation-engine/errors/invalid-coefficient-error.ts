import { DomainError } from "@/domain/errors/domain-error";

/**
 * Chyby neplatných korekčních koeficientů (AP-MCE-001 Fáze B §14) - `Material
 * Profile.create`/`MachineProfile.create` už tyhle hodnoty validují přes
 * generický `ValidationError` (konzistentně s Fází A), tahle dvojice je
 * SPECIFICKÝ typ pro `CreateMaterialCorrectionUseCase`/`CreateMachine
 * CorrectionUseCase` (Application vrstva §11) - aby use case mohl odlišit
 * "neplatný koeficient v korekci" od jiných `ValidationError` (např. prázdné
 * `id`) a vrátit odpovídající chybovou odpověď volajícímu.
 */
export class InvalidMaterialCoefficientError extends DomainError {
  constructor(readonly materialProfileId: string, readonly attemptedValue: number) {
    super(`Neplatný 'materialCoefficient' (${attemptedValue}) pro MaterialProfile "${materialProfileId}" - musí být kladné číslo.`);
  }
}

export class InvalidMachineCoefficientError extends DomainError {
  constructor(
    readonly machineProfileId: string,
    readonly coefficientName: "powerCoefficient" | "ageCoefficient" | "conditionCoefficient",
    readonly attemptedValue: number
  ) {
    super(
      `Neplatný '${coefficientName}' (${attemptedValue}) pro MachineProfile "${machineProfileId}" - musí být kladné číslo.`
    );
  }
}
