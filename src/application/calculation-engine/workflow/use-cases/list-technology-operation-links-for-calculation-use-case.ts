import { TenantContext } from "@/domain/services/tenant-context";
import { TechnologyOperationCalculationLinkRepository } from "@/domain/calculation-engine/repositories/technology-operation-calculation-link-repository";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `ListTechnologyOperationLinksForCalculationUseCase` (AP-MCE-001 Fáze H
 *  §17/§36) - `CalculationResultPage` potřebuje vypsat vazby JEDNOHO
 *  `CalculationResult`, repozitář ale umí hledat jen podle `calculationId`
 *  (u `TechnologyOperationCalculationLink`), ne podle `calculationRequestId`
 *  - tenhle use case najde všechny výsledky ve stejném řetězci revizí a pro
 *  KAŽDÝ zjistí jeho vazby, protože vazba se váže na konkrétní revizi (§17),
 *  ne na celý řetězec. */
export class ListTechnologyOperationLinksForCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly linkRepository: TechnologyOperationCalculationLinkRepository,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(calculationId: string): Promise<Record<string, unknown>[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const result = await this.calculationRepository.findResultById(calculationId, tenantId);
    if (!result) return [];
    const chain = await this.calculationRepository.findResultsByRequestId(result.calculationRequestId, tenantId);
    const links = await Promise.all(chain.map((r) => this.linkRepository.listByCalculation(r.id, tenantId)));
    return links.flat().map((l) => l.toPlainObject());
  }
}
