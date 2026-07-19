/** Nové kmenové číselníky Kroku 5 - viz docs/audits/step-5-audit.md. */

export interface CapabilityTypeRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  valueType: string;
  unit?: string;
  allowedValues?: string[];
  status: string;
}

export interface MachineCapabilityValueRecord {
  id: string;
  tenantId: string;
  machineId: string;
  capabilityTypeId: string;
  value: string | number | boolean;
}

export interface OperationTypeCapabilityRequirementRecord {
  id: string;
  tenantId: string;
  operationTypeId: string;
  capabilityTypeId: string;
  requirement: string;
  expectedValue?: string | number | boolean;
}

export interface SupplierRecord {
  id: string;
  tenantId: string;
  code?: string;
  name: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  status: string;
  note?: string;
}

export interface MaterialGroupRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: string;
}

export interface MaterialRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  materialGroupId: string;
  standard?: string;
  designation?: string;
  densityKgPerM3?: number;
  hardness?: number;
  status: string;
  note?: string;
}
