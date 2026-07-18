import { LegacyMetadata } from "./legacy-metadata";

export interface HourlyRateRecord {
  amount: number;
  currency: string;
}

export interface MachineRecord extends LegacyMetadata {
  id: string;
  nazev: string;
  oznaceni?: string;
  maxOtacky?: number;
  hourlyRate: HourlyRateRecord;
  stav: string;
  poznamka?: string;
}

export interface CapabilityLimitationsRecord {
  schemaVersion: number;
  values: Record<string, string | number | boolean>;
}

export interface MachineCapabilityRecord extends LegacyMetadata {
  id: string;
  machineId: string;
  operationTypeId: string;
  enabled: boolean;
  priority?: number;
  limitations?: CapabilityLimitationsRecord;
}

/** Číselník - nemá legacy metadata, protože nevzniká z migrace 1:1, ale ze
 *  seedu (viz infrastructure/migration/operation-type-seed.ts). */
export interface OperationTypeRecord {
  id: string;
  kod: string;
  nazev: string;
  kategorie: string;
  stav: string;
  popis?: string;
}

export interface CuttingParametersRecord {
  vc?: number;
  feed?: number;
  ap?: number;
}

export interface ToolRecord extends LegacyMetadata {
  id: string;
  nazev: string;
  toolTypeId: string;
  stav: string;
  radius?: number;
  defaultCuttingParameters?: CuttingParametersRecord;
  poznamka?: string;
}

export interface ToolTypeRecord {
  id: string;
  kod: string;
  nazev: string;
  stav: string;
  popis?: string;
}

export interface ToolMachineConditionRecord extends LegacyMetadata {
  id: string;
  toolId: string;
  machineId: string;
  parameters: CuttingParametersRecord;
  stav: string;
  operationTypeId?: string;
  materialId?: string;
  machiningMode?: string;
  priority?: number;
}
