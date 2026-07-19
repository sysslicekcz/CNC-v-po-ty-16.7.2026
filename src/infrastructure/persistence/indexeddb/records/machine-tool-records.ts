import { LegacyMetadata } from "./legacy-metadata";

export interface HourlyRateRecord {
  amount: number;
  currency: string;
}

/** Anglické názvy polí (odchylka od zbytku perzistence) - zrcadlí doménovou
 *  Machine (Krok 3.5, viz docs/audits/step-3-5-audit.md). `createdAt`/
 *  `updatedAt` jsou perzistenční audit pole - doména Machine je nemá, spravuje
 *  je repository (viz indexeddb-machine-repository.ts). */
export interface MachineRecord extends LegacyMetadata {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  designation?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  maxRpm?: number;
  maxPowerKw?: number;
  hourlyRate: HourlyRateRecord;
  status: string;
  note?: string;
  capacityGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CapabilityLimitationsRecord {
  schemaVersion: number;
  values: Record<string, string | number | boolean>;
}

export interface MachineCapabilityRecord extends LegacyMetadata {
  id: string;
  tenantId: string;
  machineId: string;
  operationTypeId: string;
  enabled: boolean;
  priority?: number;
  limitations?: CapabilityLimitationsRecord;
}

/** Číselník - od Kroku 5 tenant-aware (dřív globální, viz docs/audits/step-5-audit.md,
 *  riziko migrace č. 1 - DB verze 4 -> 5 dobackfilluje `tenantId` na existujících
 *  záznamech). Nemá legacy metadata, protože nevzniká z migrace 1:1, ale ze seedu
 *  (viz infrastructure/migration/operation-type-seed.ts). */
export interface OperationTypeRecord {
  id: string;
  tenantId: string;
  kod: string;
  nazev: string;
  kategorie: string;
  resourceRequirement: string;
  requiresSetupTime: boolean;
  requiresUnitTime: boolean;
  stav: string;
  popis?: string;
}

export interface CuttingParametersRecord {
  vc?: number;
  feed?: number;
  ap?: number;
}

export interface ToolParameterDefinitionRecord {
  key: string;
  name: string;
  valueType: string;
  unit?: string;
  required: boolean;
  allowedValues?: string[];
}

export interface ToolRecord extends LegacyMetadata {
  id: string;
  tenantId: string;
  code?: string;
  nazev: string;
  toolTypeId: string;
  manufacturer?: string;
  designation?: string;
  parameters?: Record<string, string | number | boolean>;
  stav: string;
  radius?: number;
  defaultCuttingParameters?: CuttingParametersRecord;
  poznamka?: string;
}

/** Číselník - od Kroku 5 tenant-aware, stejná výjimka jako OperationType výše. */
export interface ToolTypeRecord {
  id: string;
  tenantId: string;
  kod: string;
  nazev: string;
  category: string;
  parameterDefinitions: ToolParameterDefinitionRecord[];
  stav: string;
  popis?: string;
}

export interface ToolMachineConditionRecord extends LegacyMetadata {
  id: string;
  tenantId: string;
  toolId: string;
  machineId: string;
  parameters: CuttingParametersRecord;
  stav: string;
  operationTypeId?: string;
  materialId?: string;
  machiningMode?: string;
  priority?: number;
  source?: string;
  note?: string;
}
