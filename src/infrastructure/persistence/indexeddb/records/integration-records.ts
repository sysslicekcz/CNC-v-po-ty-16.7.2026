/** Persistenční tvary pro ERP-neutrální integrační vrstvu (Krok 3.5 dodatek -
 *  "ERP-nezávislá architektura"). Žádný z těchto typů nesmí obsahovat pole
 *  specifické pro konkrétní ERP (Helios ani jiný) - viz
 *  docs/adr/erp-agnostic-integration-layer.md. */

export interface ExternalSystemRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  connectorType: string;
  status: string;
}

export interface ExternalReferenceRecord {
  id: string;
  tenantId: string;
  externalSystemId: string;
  localEntityType: string;
  localEntityId: string;
  externalEntityType: string;
  externalId?: string;
  externalCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationRunRecord {
  id: string;
  tenantId: string;
  externalSystemId: string;
  direction: string;
  mode: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
}

export interface IntegrationIssueRecord {
  id: string;
  tenantId: string;
  externalSystemId: string;
  integrationRunId: string;
  entityType: string;
  externalId?: string;
  externalCode?: string;
  localEntityId?: string;
  type: string;
  severity: string;
  message: string;
  status: string;
}
