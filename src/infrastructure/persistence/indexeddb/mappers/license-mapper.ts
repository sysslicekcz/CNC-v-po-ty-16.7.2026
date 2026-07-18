import { License, LicenseStatus } from "@/domain/licensing/license";
import { FeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { LicenseLimitCode } from "@/domain/licensing/license-limit-code";
import { LicenseRecord, LicenseValidationRecord } from "../records";
import { parseEntityStavLike } from "./common";

const STATUS_VALUES = ["trial", "active", "expired", "suspended", "cancelled"] as const satisfies readonly LicenseStatus[];
const ACCESS_VALUES = ["none", "read", "write", "full"] as const satisfies readonly FeatureAccess[];
const VALIDATION_STATUS_VALUES = ["valid", "grace_period", "expired", "unverified", "suspended"] as const;
const FEATURE_CODE_VALUES = Object.values(FeatureCodes);
const LIMIT_CODE_VALUES = [
  "users.max",
  "machines.max",
  "routingSheets.active.max",
  "calculations.monthly.max",
  "storage.mb.max",
] as const satisfies readonly LicenseLimitCode[];

export function licenseToRecord(license: License): LicenseRecord {
  return {
    id: license.id,
    tenantId: license.tenantId,
    planCode: license.planCode,
    status: license.status,
    validFrom: license.validFrom,
    validUntil: license.validUntil,
    features: license.features.map((f) => ({ code: f.code, access: f.access })),
    limits: license.limits.map((l) => ({ code: l.code, value: l.value })),
    issuedAt: license.issuedAt,
    updatedAt: license.updatedAt,
    validation: license.validation
      ? {
          tenantId: license.tenantId,
          status: license.validation.status,
          lastValidatedAt: license.validation.lastValidatedAt,
          nextValidationAt: license.validation.nextValidationAt,
          gracePeriodUntil: license.validation.gracePeriodUntil,
        }
      : undefined,
  };
}

export function licenseFromRecord(record: LicenseRecord): License {
  return License.restore({
    id: record.id,
    tenantId: record.tenantId,
    planCode: record.planCode,
    status: parseEntityStavLike(record.status, STATUS_VALUES, "License.status"),
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    features: record.features.map((f) => ({
      code: parseEntityStavLike(f.code, FEATURE_CODE_VALUES, "LicensedFeature.code") as FeatureCode,
      access: parseEntityStavLike(f.access, ACCESS_VALUES, "LicensedFeature.access"),
    })),
    limits: record.limits.map((l) => ({
      code: parseEntityStavLike(l.code, LIMIT_CODE_VALUES, "LicenseLimit.code"),
      value: l.value,
    })),
    issuedAt: record.issuedAt,
    updatedAt: record.updatedAt,
    validation: record.validation ? validationFromRecord(record.validation) : undefined,
  });
}

function validationFromRecord(record: LicenseValidationRecord) {
  return {
    status: parseEntityStavLike(record.status, VALIDATION_STATUS_VALUES, "LicenseValidationState.status"),
    lastValidatedAt: record.lastValidatedAt,
    nextValidationAt: record.nextValidationAt,
    gracePeriodUntil: record.gracePeriodUntil,
  };
}
