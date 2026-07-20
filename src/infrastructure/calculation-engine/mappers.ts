import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { CalculationStatus } from "@/domain/calculation-engine/enums/calculation-status";
import { CalculationSeverity } from "@/domain/calculation-engine/enums/calculation-severity";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationBreakdown } from "@/domain/calculation-engine/entities/calculation-breakdown";
import { RuleVersion, RuleVersionStatus } from "@/domain/calculation-engine/rules/rule-version";
import {
  CalculationRequestRecord,
  CalculationResultRecord,
  RuleVersionRecord,
} from "@/infrastructure/persistence/indexeddb/records";

/**
 * Mapování mezi doménovými entitami Manufacturing Calculation Engine a
 * jejich IndexedDB záznamy (AP-MCE-001, Fáze A) - stejná konvence jako
 * `infrastructure/persistence/indexeddb/mappers/*.ts` (field-by-field, žádná
 * skrytá logika), jen umístěná spolu se zbytkem infrastruktury tohohle
 * modulu (`src/infrastructure/calculation-engine/`) místo sdílené
 * `persistence/indexeddb/mappers/` složky - viz `README.md` v tomhle
 * adresáři, proč se tenhle modul drží fyzicky pohromadě.
 */
export function calculationRequestToRecord(request: CalculationRequest): CalculationRequestRecord {
  return {
    id: request.id,
    tenantId: request.tenantId,
    operationCategory: request.operationCategory,
    operationTypeId: request.operationTypeId,
    idempotencyKey: request.idempotencyKey,
    inputSnapshot: { ...request.inputSnapshot },
    ruleVersionId: request.ruleVersionId,
    requestedAt: request.requestedAt,
    requestedBy: request.requestedBy,
  };
}

export function calculationRequestFromRecord(record: CalculationRequestRecord): CalculationRequest {
  return CalculationRequest.create({
    id: record.id,
    tenantId: record.tenantId,
    operationCategory: record.operationCategory as OperationCategory,
    operationTypeId: record.operationTypeId,
    idempotencyKey: record.idempotencyKey,
    inputSnapshot: { ...record.inputSnapshot },
    ruleVersionId: record.ruleVersionId,
    requestedAt: record.requestedAt,
    requestedBy: record.requestedBy,
  });
}

export function calculationResultToRecord(result: CalculationResult): CalculationResultRecord {
  return {
    id: result.id,
    tenantId: result.tenantId,
    calculationRequestId: result.calculationRequestId,
    status: result.status,
    breakdown: result.breakdown?.toJSON(),
    confidenceScore: result.confidenceScore,
    issues: [...result.issues],
    engineVersion: result.engineVersion,
    strategyVersion: result.strategyVersion,
    ruleVersionId: result.ruleVersionId,
    calculatedAt: result.calculatedAt,
    supersedesResultId: result.supersedesResultId,
    manualOverrideMinutes: result.manualOverrideMinutes,
  };
}

export function calculationResultFromRecord(record: CalculationResultRecord): CalculationResult {
  return CalculationResult.create({
    id: record.id,
    tenantId: record.tenantId,
    calculationRequestId: record.calculationRequestId,
    status: record.status as CalculationStatus,
    breakdown: record.breakdown ? CalculationBreakdown.fromJSON(record.breakdown) : undefined,
    confidenceScore: record.confidenceScore,
    issues: record.issues.map((issue) => ({ ...issue, severity: issue.severity as CalculationSeverity })),
    engineVersion: record.engineVersion,
    strategyVersion: record.strategyVersion,
    ruleVersionId: record.ruleVersionId,
    calculatedAt: record.calculatedAt,
    supersedesResultId: record.supersedesResultId,
    manualOverrideMinutes: record.manualOverrideMinutes,
  });
}

export function ruleVersionToRecord(ruleVersion: RuleVersion): RuleVersionRecord {
  return {
    id: ruleVersion.id,
    tenantId: ruleVersion.tenantId,
    version: ruleVersion.version,
    status: ruleVersion.status,
    publishedAt: ruleVersion.publishedAt,
    constants: { ...ruleVersion.constants },
  };
}

export function ruleVersionFromRecord(record: RuleVersionRecord): RuleVersion {
  return RuleVersion.create({
    id: record.id,
    tenantId: record.tenantId,
    version: record.version,
    status: record.status as RuleVersionStatus,
    publishedAt: record.publishedAt,
    constants: { ...record.constants },
  });
}
