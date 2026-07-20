/**
 * IndexedDB záznamy pro Manufacturing Calculation Engine (AP-MCE-001, Fáze A).
 * Stejná konvence jako zbytek `records/` - ploché, serializovatelné tvary;
 * mapování na/z doménových entit dělají `mappers/calculation-engine-mapper.ts`.
 */
export interface CalculationRequestRecord {
  id: string;
  tenantId: string;
  operationCategory: string;
  operationTypeId: string;
  idempotencyKey: string;
  inputSnapshot: Record<string, unknown>;
  ruleVersionId: string;
  requestedAt: string;
  requestedBy?: string;
}

export interface CalculationResultRecord {
  id: string;
  tenantId: string;
  calculationRequestId: string;
  status: string;
  breakdown?: Record<string, unknown>;
  confidenceScore?: number;
  issues: Array<{ code: string; severity: string; message: string; field?: string }>;
  engineVersion: string;
  strategyVersion?: string;
  ruleVersionId: string;
  calculatedAt: string;
  supersedesResultId?: string;
  manualOverrideMinutes?: number;
}

export interface RuleVersionRecord {
  id: string;
  tenantId: string;
  version: string;
  status: string;
  publishedAt: string;
  constants: Record<string, number>;
}
