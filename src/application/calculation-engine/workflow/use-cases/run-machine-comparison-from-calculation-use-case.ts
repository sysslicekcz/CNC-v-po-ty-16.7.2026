import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationRepository } from "@/domain/calculation-engine/repositories/calculation-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { GetMachineComparisonUseCase, MachineComparisonEntry } from "./get-machine-comparison-use-case";

export interface RunMachineComparisonFromCalculationInput {
  calculationId: string;
  machineProfileIds: readonly string[];
  actorId?: string;
  correlationId?: string;
}

/**
 * `RunMachineComparisonFromCalculationUseCase` (AP-MCE-001 Fáze H §15/§36) -
 * jediné místo, které smí přetypovat `CalculationRequest.inputSnapshot` zpátky
 * na konkrétní `Turning/Milling/GrindingCalculationInput` (bezpečné, protože
 * snapshot vznikl PŘESNĚ pro tuhle kategorii, viz `PreviewCalculationUseCase`
 * komentář ke stejné technice) - `MachineComparisonPage` tak nemusí sama
 * sestavovat vstup, jen vybere výchozí výpočet + kandidátní stroje.
 */
export class RunMachineComparisonFromCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly calculationRepository: CalculationRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly getMachineComparisonUseCase: GetMachineComparisonUseCase
  ) {}

  async execute(input: RunMachineComparisonFromCalculationInput): Promise<MachineComparisonEntry[]> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");

    const result = await this.calculationRepository.findResultById(input.calculationId, tenantId);
    if (!result) throw new CalculationError(`CalculationResult "${input.calculationId}" nebyl nalezen.`);
    const request = await this.calculationRepository.findRequestById(result.calculationRequestId, tenantId);
    if (!request) throw new CalculationError(`CalculationRequest pro výpočet "${input.calculationId}" nebyl nalezen.`);

    const snapshot = request.inputSnapshot;
    switch (request.operationCategory) {
      case "turning":
        return this.getMachineComparisonUseCase.execute({
          operationCategory: "turning",
          input: snapshot as unknown as TurningCalculationInput,
          machineProfileIds: input.machineProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      case "milling":
        return this.getMachineComparisonUseCase.execute({
          operationCategory: "milling",
          input: snapshot as unknown as MillingCalculationInput,
          machineProfileIds: input.machineProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      case "grinding":
        return this.getMachineComparisonUseCase.execute({
          operationCategory: "grinding",
          input: snapshot as unknown as GrindingCalculationInput,
          machineProfileIds: input.machineProfileIds,
          actorId: input.actorId,
          correlationId: input.correlationId,
        });
      default:
        throw new CalculationError(`Porovnání strojů není pro kategorii "${request.operationCategory}" k dispozici.`);
    }
  }
}
