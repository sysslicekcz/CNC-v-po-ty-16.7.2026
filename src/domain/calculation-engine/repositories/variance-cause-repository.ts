import { VarianceCauseAssignment } from "../calibration/variance-cause";

/** Port pro `VarianceCauseAssignment` (AP-MCE-001 Fáze G §10/§23). */
export interface VarianceCauseRepository {
  getById(id: string, tenantId: string): Promise<VarianceCauseAssignment | null>;
  listByCalculation(calculationId: string, calculationRevision: number, tenantId: string): Promise<VarianceCauseAssignment[]>;
  listByTenant(tenantId: string): Promise<VarianceCauseAssignment[]>;
  save(assignment: VarianceCauseAssignment): Promise<void>;
  saveMany(assignments: readonly VarianceCauseAssignment[]): Promise<void>;
}
