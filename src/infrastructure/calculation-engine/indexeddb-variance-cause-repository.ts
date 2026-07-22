import { VarianceCauseRepository } from "@/domain/calculation-engine/repositories/variance-cause-repository";
import { VarianceCauseAssignment } from "@/domain/calculation-engine/calibration/variance-cause";
import { VarianceCauseAssignmentRecord } from "@/infrastructure/persistence/indexeddb/records";
import { tpvGet, tpvGetAllByIndex, tpvPut } from "@/infrastructure/persistence/indexeddb/tpv-db";
import { varianceCauseAssignmentToRecord, varianceCauseAssignmentFromRecord } from "./calibration-mappers";

/** IndexedDB implementace `VarianceCauseRepository` (AP-MCE-001 Fáze G
 *  §10/§23). */
export class IndexedDbVarianceCauseRepository implements VarianceCauseRepository {
  async getById(id: string, tenantId: string): Promise<VarianceCauseAssignment | null> {
    const record = await tpvGet<VarianceCauseAssignmentRecord>("tpvVarianceCauseAssignments", id);
    if (!record || record.tenantId !== tenantId) return null;
    return varianceCauseAssignmentFromRecord(record);
  }

  async listByCalculation(calculationId: string, calculationRevision: number, tenantId: string): Promise<VarianceCauseAssignment[]> {
    const records = await tpvGetAllByIndex<VarianceCauseAssignmentRecord>("tpvVarianceCauseAssignments", "calculationId", calculationId);
    return records.filter((r) => r.tenantId === tenantId && r.calculationRevision === calculationRevision).map(varianceCauseAssignmentFromRecord);
  }

  async listByTenant(tenantId: string): Promise<VarianceCauseAssignment[]> {
    const records = await tpvGetAllByIndex<VarianceCauseAssignmentRecord>("tpvVarianceCauseAssignments", "tenantId", tenantId);
    return records.map(varianceCauseAssignmentFromRecord);
  }

  async save(assignment: VarianceCauseAssignment): Promise<void> {
    await tpvPut("tpvVarianceCauseAssignments", varianceCauseAssignmentToRecord(assignment));
  }

  async saveMany(assignments: readonly VarianceCauseAssignment[]): Promise<void> {
    for (const assignment of assignments) await this.save(assignment);
  }
}
