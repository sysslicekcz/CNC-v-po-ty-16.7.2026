import { DomainError } from "@/domain/errors/domain-error";

/**
 * Vstup výpočtu překračuje fyzické možnosti přiřazeného stroje (AP-MCE-001
 * §18): otáčky nad `Machine.maxRpm`, výkon nad `maxPowerKw`, rozměr dílu nad
 * pracovní prostor. Rozměr/otáčky jsou v AP-MCE-001 klasifikované jako
 * blokující `error`, výkon jen jako `warning` - tahle třída pokrývá OBĚ
 * situace, rozlišení dělá `severity`, ne samostatná chyba pro každý případ.
 */
export class MachineLimitError extends DomainError {
  constructor(
    readonly limitKind: "max_rpm" | "max_power" | "work_envelope" | "max_part_weight",
    message: string
  ) {
    super(message);
  }

  static exceedsMaxRpm(machineId: string, requestedRpm: number, maxRpm: number): MachineLimitError {
    return new MachineLimitError(
      "max_rpm",
      `Požadované otáčky (${requestedRpm} min⁻¹) překračují maximum stroje "${machineId}" (${maxRpm} min⁻¹).`
    );
  }

  static exceedsMaxPower(machineId: string, requiredKw: number, maxKw: number): MachineLimitError {
    return new MachineLimitError(
      "max_power",
      `Požadovaný výkon (${requiredKw} kW) překračuje maximum stroje "${machineId}" (${maxKw} kW).`
    );
  }

  static exceedsWorkEnvelope(machineId: string): MachineLimitError {
    return new MachineLimitError("work_envelope", `Rozměr dílu překračuje pracovní prostor stroje "${machineId}".`);
  }

  static exceedsMaxPartWeight(machineId: string, requestedWeightKg: number, maxWeightKg: number): MachineLimitError {
    return new MachineLimitError(
      "max_part_weight",
      `Hmotnost dílu (${requestedWeightKg} kg) překračuje maximum stroje "${machineId}" (${maxWeightKg} kg).`
    );
  }
}
