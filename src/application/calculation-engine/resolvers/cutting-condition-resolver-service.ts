import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";
import { FeedRateUnit } from "@/domain/calculation-engine/value-objects/feed-rate";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { CuttingConditionRepository } from "@/domain/calculation-engine/repositories/cutting-condition-repository";
import { resolveCuttingConditions, CuttingConditionResolution } from "@/domain/calculation-engine/cutting-conditions/cutting-condition-resolver";
import { CuttingConditionSnapshot } from "@/domain/calculation-engine/cutting-conditions/cutting-condition-snapshot";
import { MaterialProfileResolver } from "./material-profile-resolver";
import { ToolProfileResolver } from "./tool-profile-resolver";

export interface ResolveCuttingConditionsForContextInput {
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  operationCategory: OperationCategory;
  operationSubtype?: string;
  feedUnit: FeedRateUnit;
  explicitValues?: { cuttingSpeed?: CuttingSpeed; feed?: FeedRate };
}

export interface CuttingConditionResolutionWithSnapshot {
  resolution: CuttingConditionResolution;
  snapshot: CuttingConditionSnapshot;
}

/**
 * Sdílená Application-vrstvá logika okolo `resolveCuttingConditions()`
 * (AP-MCE-001 Fáze B §5/§6) - JEDINÉ místo, které načte kandidáty/materiál/
 * nástroj z repozitářů a zavolá čistou doménovou funkci + sestaví snapshot.
 * Použití: `ResolveCuttingConditionsUseCase` (samostatně) i
 * `CalculationContextResolver` (jako součást celého kontextu) - obojí by
 * jinak muselo duplikovat stejné načítání kandidátů/systémového defaultu.
 */
export class CuttingConditionResolverService {
  constructor(
    private readonly cuttingConditionRepository: CuttingConditionRepository,
    private readonly materialProfileResolver: MaterialProfileResolver,
    private readonly toolProfileResolver: ToolProfileResolver
  ) {}

  async resolve(input: ResolveCuttingConditionsForContextInput, createdAt: string): Promise<CuttingConditionResolutionWithSnapshot> {
    const material = await this.materialProfileResolver.resolve(input.materialProfileId, input.tenantId);
    const tool = input.toolProfileId ? await this.toolProfileResolver.resolve(input.toolProfileId, input.tenantId) : undefined;

    const [candidates, systemDefault] = await Promise.all([
      this.cuttingConditionRepository.findCandidates({
        tenantId: input.tenantId,
        materialProfileId: input.materialProfileId,
        machineProfileId: input.machineProfileId,
        toolProfileId: input.toolProfileId,
        operationCategory: input.operationCategory,
      }),
      this.cuttingConditionRepository.findSystemDefault(input.tenantId, input.operationCategory),
    ]);

    const resolution = resolveCuttingConditions(
      {
        materialProfileId: input.materialProfileId,
        machineProfileId: input.machineProfileId,
        toolProfileId: input.toolProfileId,
        operationCategory: input.operationCategory,
        operationSubtype: input.operationSubtype,
        feedUnit: input.feedUnit,
        explicitValues: input.explicitValues,
      },
      {
        candidates,
        materialProfile: material.resolved,
        toolProfile: tool?.resolved,
        systemDefault: systemDefault ?? undefined,
      }
    );

    const snapshot = CuttingConditionSnapshot.forResolution(resolution, {
      tenantId: input.tenantId,
      materialProfileId: input.materialProfileId,
      machineProfileId: input.machineProfileId,
      toolProfileId: input.toolProfileId,
      createdAt,
    });

    return { resolution, snapshot };
  }
}
