import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { buildPlanningTimeInput, PlanningTimeInput } from "../../planning/planning-time-input";

/**
 * `CreatePlanningTimeInputUseCase` (AP-MCE-001 Fáze H §18/§36) - jediné
 * místo, které smí `PlanningTimeInput` sestavit (repository lookupy +
 * revize patří sem, čistou projekci samotnou dělá `buildPlanningTimeInput`).
 * Vyžaduje SCHVÁLENÝ nebo aspoň dokončený výpočet (`isFailed` blokuje -
 * neúspěšný výpočet nemá breakdown, tedy ani čas k předání).
 */
export class CreatePlanningTimeInputUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(calculationId: string): Promise<PlanningTimeInput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const result = await this.calculationRepository.findResultById(calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${calculationId}" nebyl nalezen.`);
    if (result.isFailed) throw new CalculationError(`CalculationResult "${calculationId}" selhal - nemá čas k předání do plánování.`);

    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) throw new CalculationError(`CalculationRequest "${result.calculationRequestId}" nebyl nalezen.`);

    const chain = await this.calculationRepository.findResultsByRequestId(result.calculationRequestId, tenantId);
    const oldestFirst = [...chain].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt));
    const calculationRevision = oldestFirst.findIndex((r) => r.id === result.id) + 1;

    return buildPlanningTimeInput(result, request, calculationRevision);
  }
}
