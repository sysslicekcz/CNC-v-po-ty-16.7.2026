import { CalibrationSample } from "../calibration/calibration-sample";

/** Port pro `CalibrationSample` (AP-MCE-001 Fáze G §11/§23). */
export interface CalibrationSampleRepository {
  getById(id: string, tenantId: string): Promise<CalibrationSample | null>;
  listByTenant(tenantId: string): Promise<CalibrationSample[]>;
  listByDateRange(tenantId: string, fromIso: string, toIso: string): Promise<CalibrationSample[]>;
  /** Vzorky odpovídající rozsahu profilu (§13 scope) - filtr provede
   *  Application vrstva (`GenerateCalibrationProposalUseCase`), tenhle
   *  port jen vrátí VŠECHNY vzorky tenanta v požadovaném období, ať
   *  filtrace zůstane na jednom místě (use case), ne duplicitně v každém
   *  repozitáři. */
  save(sample: CalibrationSample): Promise<void>;
  saveMany(samples: readonly CalibrationSample[]): Promise<void>;
}
