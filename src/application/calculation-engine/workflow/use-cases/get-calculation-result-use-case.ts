import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";

/** `GetCalculationResultUseCase` (AP-MCE-001 Fáze H §11/§36) - Application
 *  vrstva dosud NEMĚLA žádný use case pro čtení JEDNOHO `CalculationResult`
 *  (jen repozitářová metoda `findResultById`) - `CalculationResultPage`
 *  (§11) potřebuje projít přes use case, ne přímo přes repozitář (UI
 *  komponenty nesmí přistupovat k repository, §36). */
export class GetCalculationResultUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<OperationCalculationOutput | null> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const result = await this.calculationRepository.findResultById(id, tenantId);
    if (!result) return null;
    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    return toOperationCalculationOutput(result, request ?? undefined);
  }
}
