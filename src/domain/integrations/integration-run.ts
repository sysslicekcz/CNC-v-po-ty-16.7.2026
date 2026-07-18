export type IntegrationDirection = "import" | "export" | "sync";
export type IntegrationMode = "manual" | "scheduled" | "automatic";
export type IntegrationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

/**
 * ERP-neutrální záznam o jednom běhu importu/exportu/synchronizace s daným
 * `ExternalSystem` - obdoba `MigrationRunRecord` (Krok 3), ale pro OPAKOVANÉ
 * běhy proti externímu systému, ne jednorázovou migraci legacy dat. Žádné
 * pole specifické pro konkrétní ERP - to, co je Helios/SAP/... specifické,
 * zůstává uvnitř konkrétního konektoru a nepromítá se sem (viz
 * docs/adr/anti-corruption-layer-for-erp-connectors.md).
 */
export interface IntegrationRun {
  id: string;
  tenantId: string;
  externalSystemId: string;

  direction: IntegrationDirection;
  mode: IntegrationMode;

  status: IntegrationRunStatus;

  startedAt: string;
  finishedAt?: string;

  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}
