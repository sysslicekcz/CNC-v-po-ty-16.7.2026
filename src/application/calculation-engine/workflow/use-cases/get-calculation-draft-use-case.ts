import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationDraftRepository } from "@/domain/calculation-engine/repositories/calculation-draft-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

/** `GetCalculationDraftUseCase` (AP-MCE-001 Fáze H §4/§36) - "znovuotevření
 *  konceptu". */
export class GetCalculationDraftUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly draftRepository: CalculationDraftRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string): Promise<Record<string, unknown> | null> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const draft = await this.draftRepository.getById(id, tenantId);
    return draft ? draft.toPlainObject() : null;
  }
}
