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
export function toOperationCalculationOutput(result: CalculationResult): OperationCalculationOutput {
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
