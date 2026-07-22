import { CalibrationProposal } from "../calibration/calibration-proposal";

/** Port pro `CalibrationProposal` (AP-MCE-001 Fáze G §16/§23). */
export interface CalibrationProposalRepository {
  getById(id: string, tenantId: string): Promise<CalibrationProposal | null>;
  listByTenant(tenantId: string): Promise<CalibrationProposal[]>;
  save(proposal: CalibrationProposal): Promise<void>;
}
