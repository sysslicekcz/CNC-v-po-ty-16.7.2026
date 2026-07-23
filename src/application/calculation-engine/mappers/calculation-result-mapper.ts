import { CalculationResult } from "@/domain/calculation-engine/entities/calculation-result";
import { CalculationRequest } from "@/domain/calculation-engine/entities/calculation-request";
import { OperationCalculationOutput } from "../dto/operation-calculation-output";
import { CalculationSummary } from "../dto/calculation-summary";

/**
 * Factory metody pro převod doménových entit na Application DTO (AP-MCE-001
 * §10 "Presentation nesmí obsahovat technologické výpočty" - mapování je
 * čistě datová projekce, žádná další logika, takže může žít i mimo use case
 * samotný a znovupoužít se z budoucí Presentation/API vrstvy beze změny).
 */
/** `request` je volitelný (Fáze H §11 doplněk) - jen volající, které ho mají
 *  po ruce (`GetCalculationResultUseCase`/`ListCalculationResultsUseCase`),
 *  ho předávají; ostatní Fáze C-G volání zůstávají beze změny. */
export function toOperationCalculationOutput(result: CalculationResult, request?: CalculationRequest): OperationCalculationOutput {
  return {
    calculationId: result.id,
    calculationRequestId: result.calculationRequestId,
    status: result.status,
    engineVersion: result.engineVersion,
    strategyVersion: result.strategyVersion,
    ruleVersionId: result.ruleVersionId,
    confidenceScore: result.confidenceScore,
    breakdown: result.breakdown?.toJSON(),
    finalOperationTimeMinutes: result.isFailed ? undefined : result.finalOperationTime.minutes,
    issues: result.issues,
    calculatedAt: result.calculatedAt,
    operationCategory: request?.operationCategory,
    operationTypeId: request?.operationTypeId,
    reviewedBy: result.reviewedBy,
    reviewedAt: result.reviewedAt,
    rejectionReason: result.rejectionReason,
    archivedAt: result.archivedAt,
    materialProfileSnapshot: result.materialProfileSnapshot as Record<string, unknown> | undefined,
    machineProfileSnapshot: result.machineProfileSnapshot as Record<string, unknown> | undefined,
  };
}

export function toCalculationSummary(result: CalculationResult, request: CalculationRequest): CalculationSummary {
  return {
    calculationId: result.id,
    operationCategory: request.operationCategory,
    operationTypeId: request.operationTypeId,
    status: result.status,
    totalOperationTimeMinutes: result.isFailed ? undefined : result.finalOperationTime.minutes,
    confidenceScore: result.confidenceScore,
    hasManualOverride: result.manualOverrideMinutes !== undefined,
    calculatedAt: result.calculatedAt,
  };
}
