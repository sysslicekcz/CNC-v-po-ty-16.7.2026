import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { toOperationCalculationOutput } from "../../mappers/calculation-result-mapper";
import { OperationCalculationOutput } from "../../dto/operation-calculation-output";

export interface CalculationRevisionEntry extends OperationCalculationOutput {
  /** Pozice v řetězci revizí (1 = nejstarší) - stejný výpočet jako Fáze G
   *  `MatchActualTimeToCalculationUseCase.calculationRevision`. */
  revision: number;
  supersedesResultId?: string;
}

/** `GetCalculationRevisionHistoryUseCase` (AP-MCE-001 Fáze H §11/§36) -
 *  "Historie revizí" JEDNOHO `calculationRequestId`, nejstarší první
 *  (`revision` 1..N), stejná definice revize jako Fáze G. */
export class GetCalculationRevisionHistoryUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(calculationRequestId: string): Promise<CalculationRevisionEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const results = await this.calculationRepository.findResultsByRequestId(calculationRequestId, tenantId);
    const oldestFirst = [...results].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt));
    return oldestFirst.map((result, index) => ({
      ...toOperationCalculationOutput(result),
      revision: index + 1,
      supersedesResultId: result.supersedesResultId,
    }));
  }
}
