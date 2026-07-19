export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface CapacityGroupRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  status: string;
  note?: string;
}

export interface MoneyRecord {
  amount: number;
  currency: string;
}

export interface ExternalOperationResourceRecord {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  supplierId?: string;
  supportedOperationTypeIds?: string[];
  defaultLeadTimeDays?: number;
  defaultCost?: MoneyRecord;
  status: string;
  note?: string;
}

export interface LicensedFeatureRecord {
  code: string;
  access: string;
}

export interface LicenseLimitRecord {
  code: string;
  value: number;
}

export interface LicenseValidationRecord {
  tenantId: string;
  status: string;
  lastValidatedAt?: string;
  nextValidationAt?: string;
  gracePeriodUntil?: string;
}

export interface LicenseRecord {
  id: string;
  tenantId: string;
  planCode: string;
  status: string;
  validFrom: string;
  validUntil?: string;
  features: LicensedFeatureRecord[];
  limits: LicenseLimitRecord[];
  issuedAt: string;
  updatedAt?: string;
  validation?: LicenseValidationRecord;
}
