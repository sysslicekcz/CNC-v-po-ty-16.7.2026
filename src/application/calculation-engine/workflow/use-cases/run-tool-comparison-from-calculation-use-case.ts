import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { GetToolComparisonUseCase, ToolComparisonEntry } from "./get-tool-comparison-use-case";

export interface RunToolComparisonFromCalculationInput {
  calculationId: string;
  toolProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

/** `RunToolComparisonFromCalculationUseCase` (AP-MCE-001 Fáze H §16/§36) -
 *  stejný princip jako `RunMachineComparisonFromCalculationUseCase`, jen pro
 *  nástroje/kotouče. Porovnává PRVNÍ technologický úsek uloženého vstupu
 *  (`featureId`) - výběr konkrétního úseku k porovnání je scope, který tahle
 *  MVP verze nechává na budoucí iteraci (`ToolComparisonPage` zatím nemá
 *  vlastní přepínač úseků). */
export class RunToolComparisonFromCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly getToolComparisonUseCase: GetToolComparisonUseCase
  ) {}

  async execute(input: RunToolComparisonFromCalculationInput): Promise<ToolComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const result = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);
    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) throw new CalculationError(`CalculationRequest pro výpočet "${input.calculationId}" nebyl nalezen.`);

    const snapshot = request.inputSnapshot;
    const features = snapshot.features as { id?: string }[] | undefined;
    const featureId = features?.[0]?.id;
    if (!featureId) throw new CalculationError("Uložený vstup nemá žádný technologický úsek k porovnání nástrojů.");

    switch (request.operationCategory) {
      case "turning":
        return this.getToolComparisonUseCase.execute({
          operationCategory: "turning",
          input: snapshot as unknown as TurningCalculationInput,
          featureId,
          toolProfileIds: input.toolProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      case "milling":
        return this.getToolComparisonUseCase.execute({
          operationCategory: "milling",
          input: snapshot as unknown as MillingCalculationInput,
          featureId,
          toolProfileIds: input.toolProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      case "grinding":
        return this.getToolComparisonUseCase.execute({
          operationCategory: "grinding",
          input: snapshot as unknown as GrindingCalculationInput,
          featureId,
          toolProfileIds: input.toolProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      default:
        throw new CalculationError(`Porovnání nástrojů není pro kategorii "${request.operationCategory}" k dispozici.`);
    }
  }
}
