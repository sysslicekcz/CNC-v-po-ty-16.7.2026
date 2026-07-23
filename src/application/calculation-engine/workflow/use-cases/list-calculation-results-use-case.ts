import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { toCalculationSummary } from "../../mappers/calculation-result-mapper";
import { CalculationSummary } from "../../dto/calculation-summary";

/** `ListCalculationResultsUseCase` (AP-MCE-001 Fáze H §11/§36) - "Historie
 *  výpočtů". Application vrstva dosud neměla ŽÁDNÝ use case nad
 *  `CalculationRepository.listResultsByTenant` (jen přímé repozitářové
 *  volání z Fáze G matcheru) - `CalculationResultPage`/historie výpočtů
 *  potřebuje projít přes use case (UI nesmí přistupovat k repository
 *  přímo). Dotáhne odpovídající `CalculationRequest` pro každý výsledek
 *  (kategorie/typ operace pro filtr/zobrazení v tabulce). */
export class ListCalculationResultsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<CalculationSummary[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const results = await this.calculationRepository.listResultsByTenant(tenantId);
    const summaries: CalculationSummary[] = [];
    for (const result of results) {
      const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
      if (!request) continue;
      summaries.push(toCalculationSummary(result, request));
    }
    return summaries.sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
  }
}
