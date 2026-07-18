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
  maxRpm?: number;
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

/** Číselník - globální systémový, ne tenant-aware (zdokumentovaná výjimka,
 *  viz docs/adr/0019): kategorie/typy operací jsou odvozené z pevné sady
 *  vzorců výpočtového enginu (src/lib/operations.ts), ne z organizačních dat -
 *  všichni tenanti dnes sdílejí stejný seed a appka nenabízí jejich úpravu.
 *  Nemá legacy metadata, protože nevzniká z migrace 1:1, ale ze seedu (viz
 *  infrastructure/migration/operation-type-seed.ts). */
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
  tenantId: string;
  code?: string;
  nazev: string;
  toolTypeId: string;
  stav: string;
  radius?: number;
  defaultCuttingParameters?: CuttingParametersRecord;
  poznamka?: string;
}

/** Číselník - stejná výjimka jako OperationType výše (globální, ne tenant-aware). */
export interface ToolTypeRecord {
  id: string;
  kod: string;
  nazev: string;
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
}
