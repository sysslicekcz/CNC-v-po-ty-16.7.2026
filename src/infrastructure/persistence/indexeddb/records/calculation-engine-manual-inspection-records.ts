/**
 * IndexedDB záznamy pro Manuální operace / Kontrolu (AP-MCE-001 Fáze F §5/§9/§18) -
 * stejná konvence jako `calculation-engine-profile-records.ts` (Fáze B):
 * ploché, serializovatelné tvary, mapování dělá `infrastructure/calculation-
 * engine/manual-inspection-mappers.ts`.
 */
export interface ManualTimeStandardRecord {
  id: string;
  tenantId?: string;
  siteId?: string;
  operationSubtype: string;
  standardName: string;
  standardVersion: string;
  source: string;
  baseTimeMin: number;
  quantityBasis: string;
  complexityRange?: { min: string; max: string };
  validFrom: string;
  validTo?: string;
  approvedBy?: string;
  approvedAt?: string;
  archivedAt?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionEquipmentProfileRecord {
  id: string;
  tenantId: string;
  siteId?: string;
  equipmentType: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supportedInspectionSubtypes: string[];
  accuracy?: number;
  measurementRange?: { min: number; max: number };
  setupTimeMin: number;
  calibrationValidTo?: string;
  equipmentCoefficient: number;
  automationLevel: string;
  reportGenerationMode: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
