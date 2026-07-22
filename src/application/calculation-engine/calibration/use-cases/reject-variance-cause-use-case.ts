import { TenantContext } from "@/domain/services/tenant-context";
import { VarianceCauseRepository } from "@/domain/calculation-engine/repositories/variance-cause-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface RejectVarianceCauseInput {
  varianceCauseAssignmentId: string;
  rejectedBy: string;
}

/** `RejectVarianceCauseUseCase` (AP-MCE-001 Fáze G §10/§22) - uživatel
 *  odmítne navrženou příčinu jako nesprávnou (§10 "odmítnout"). Žádná
 *  vlastní `variance_cause.*` událost pro odmítnutí není v §25 uvedená -
 *  `variance_cause.confirmed` pokrývá jen kladné potvrzení. */
export class RejectVarianceCauseUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly repository: VarianceCauseRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: RejectVarianceCauseInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationReview, "write");

    const assignment = await this.repository.getById(input.varianceCauseAssignmentId, tenantId);
    if (!assignment) throw new CalculationError(`VarianceCauseAssignment "${input.varianceCauseAssignmentId}" nebyl nalezen.`);

    const now = new Date().toISOString();
    const rejected = assignment.reject(input.rejectedBy, now);
    await this.repository.save(rejected);

    return rejected.toPlainObject();
  }
}
