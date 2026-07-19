import { IntegrationRun } from "../integrations/integration-run";

/** Tenant-scoped. `IntegrationRun` je čistě datový záznam (ne entita s
 *  chráněnými invarianty) - repository proto nemá `delete` (běhy se
 *  neuklízí, jsou to auditní data, stejně jako `MigrationRunRecord`). */
export interface IntegrationRunRepository {
  findById(id: string, tenantId: string): Promise<IntegrationRun | null>;
  listByExternalSystem(tenantId: string, externalSystemId: string): Promise<IntegrationRun[]>;
  save(run: IntegrationRun): Promise<void>;
}
