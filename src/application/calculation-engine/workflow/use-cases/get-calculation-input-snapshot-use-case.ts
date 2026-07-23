import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";

export interface CalculationInputSnapshot {
  operationCategory: OperationCategory;
  operationTypeId: string;
  /** Přesně to, co bylo uloženo v `CalculationRequest.inputSnapshot` v
   *  okamžiku původního výpočtu (Fáze A §8) - `MachineComparisonPage`/
   *  `ToolComparisonPage` (§15/§16) ho použijí jako výchozí vstup, mění se
   *  jen `machineId`/nástroj u featurů podle vybraného kandidáta. */
  inputSnapshot: Record<string, unknown>;
}

/** `GetCalculationInputSnapshotUseCase` (AP-MCE-001 Fáze H §15/§16/§36) -
 *  dovoluje `MachineComparisonPage`/`ToolComparisonPage` vyjít z existujícího
 *  výpočtu, aniž by musely znovu sestavovat celý vstup ručně - Application
 *  vrstva dosud neměla ŽÁDNÝ use case čtoucí `CalculationRequest.inputSnapshot`
 *  mimo interní matcher (Fáze G). */
export class GetCalculationInputSnapshotUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(calculationId: string): Promise<CalculationInputSnapshot | null> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const result = await this.calculationRepository.findResultById(calculationId, tenantId);
    if (!result) return null;
    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) return null;

    return {
      operationCategory: request.operationCategory,
      operationTypeId: request.operationTypeId,
      inputSnapshot: { ...request.inputSnapshot },
    };
  }
}
