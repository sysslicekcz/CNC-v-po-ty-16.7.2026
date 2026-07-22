import { CalibrationProposalRepository } from "@/domain/calculation-engine/repositories/calibration-proposal-repository";
import { CalibrationProposal } from "@/domain/calculation-engine/calibration/calibration-proposal";
import { CalibrationProposalRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { calibrationProposalToRecord, calibrationProposalFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `CalibrationProposalRepository` (AP-MCE-001 Fáze G
 *  §16/§23). */
export class IndexedDbCalibrationProposalRepository implements CalibrationProposalRepository {
  async getById(id: string, tenantId: string): Promise<CalibrationProposal | null> {
    const record = await tpvGet<CalibrationProposalRecord>("tpvCalibrationProposals", id);
    if (!record || record.tenantId !== tenantId) return null;
    return calibrationProposalFromRecord(record);
  }

  async listByTenant(tenantId: string): Promise<CalibrationProposal[]> {
    const records = await tpvGetAllByIndex<CalibrationProposalRecord>("tpvCalibrationProposals", "tenantId", tenantId);
    return records.map(calibrationProposalFromRecord);
  }

  async save(proposal: CalibrationProposal): Promise<void> {
    await tpvPut("tpvCalibrationProposals", calibrationProposalToRecord(proposal));
  }
}
