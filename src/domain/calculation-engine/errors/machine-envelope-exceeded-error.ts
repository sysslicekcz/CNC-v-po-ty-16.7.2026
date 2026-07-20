import { MachineLimitError } from "./machine-limit-error";

/**
 * Specificky pojmenovaný podtyp `MachineLimitError` pro překročení pracovního
 * prostoru (AP-MCE-001 Fáze B §14 vyžaduje jméno `MachineEnvelopeExceeded
 * Error` explicitně) - `limitKind` zůstává `"work_envelope"`, takže existující
 * `expect(...).toThrow(MachineLimitError)` (Fáze B `machine-profile.test.ts`)
 * dál prochází beze změny (podtřída je pořád `instanceof MachineLimitError`).
 */
export class MachineEnvelopeExceededError extends MachineLimitError {
  static forProfile(machineProfileId: string): MachineEnvelopeExceededError {
    const error = new MachineEnvelopeExceededError(
      "work_envelope",
      `Rozměr dílu překračuje pracovní prostor stroje "${machineProfileId}".`
    );
    return error;
  }
}
