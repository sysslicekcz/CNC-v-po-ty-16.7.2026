import { CalculationContext, GrindingResolvedCuttingConditionForFeature } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { MaterialProfileResolver } from "../resolvers/material-profile-resolver";
import { ToolProfileResolver } from "../resolvers/tool-profile-resolver";
import { CuttingConditionResolverService } from "../resolvers/cutting-condition-resolver-service";

/** Zúžený tvar `GrindingCalculationContextBuilder` (jen `build`), na kterém
 *  závisí use casy - stejný důvod jako Fáze C/D `*ContextBuilderPort`. */
export type GrindingCalculationContextBuilderPort = Pick<GrindingCalculationContextBuilder, "build">;

export interface BuildGrindingCalculationContextOptions {
  /** Přepis `MachineProfile.id` (§17 "CompareGrindingMachinesUseCase ...
   *  nahradit pouze MachineProfile"). */
  machineProfileIdOverride?: string;
  /** Přepis `ToolProfile.id` (kotouč) PRO KONKRÉTNÍ feature (§17
   *  "CompareGrindingWheelsUseCase" analogicky). */
  wheelProfileIdOverrideByFeatureId?: Readonly<Record<string, string>>;
}

/**
 * `GrindingCalculationContextBuilder` (AP-MCE-001 Fáze E §1/§9) -
 * Application-vrstvá služba, KTERÁ SMÍ volat repozitáře. SDÍLENÝ pro OBĚ
 * brusírenské strategie (`CylindricalGrindingCalculationStrategy`/
 * `SurfaceGrindingCalculationStrategy`) - stejný `GrindingCalculationInput`
 * tvar, jen jiný dispatch podle `features[].subtype` (viz `Grinding
 * CalculationStrategy` dispatcher). Broušecí kotouč je modelovaný jako
 * `ToolProfile` (žádná nová entita `WheelProfile`), proto `toolProfile
 * SnapshotsByFeatureId`/`ToolProfileResolver` beze změny.
 */
export class GrindingCalculationContextBuilder {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly materialProfileResolver: MaterialProfileResolver,
    private readonly machineProfileRepository: MachineProfileRepository,
    private readonly toolProfileResolver: ToolProfileResolver,
    private readonly cuttingConditionResolverService: CuttingConditionResolverService
  ) {}

  async build(input: GrindingCalculationInput, tenantId: string, options: BuildGrindingCalculationContextOptions = {}): Promise<CalculationContext> {
    const now = new Date().toISOString();

    const ruleVersion = input.ruleVersionId
      ? await this.ruleRepository.findById(input.ruleVersionId, tenantId)
      : await this.ruleRepository.findActiveVersion(tenantId);
    if (!ruleVersion) {
      throw new CalculationError(
        input.ruleVersionId ? `Verze pravidel "${input.ruleVersionId}" nebyla nalezena.` : `Pro organizaci "${tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
      );
    }

    const materialProfileSnapshot = await this.materialProfileResolver.resolveSnapshot(input.materialId, tenantId, now);

    let machineProfileId = options.machineProfileIdOverride;
    if (!machineProfileId && input.machineId) {
      const machineProfiles = await this.machineProfileRepository.listByTenant(tenantId);
      machineProfileId = machineProfiles.find((p) => p.physicalMachineId === input.machineId)?.id;
    }
    const machineProfile = machineProfileId ? await this.machineProfileRepository.getById(machineProfileId, tenantId) : null;
    const machineProfileSnapshot = machineProfileId ? await this.machineProfileRepository.getSnapshot(machineProfileId, tenantId) : null;

    const toolProfileSnapshotsByFeatureId: Record<string, Awaited<ReturnType<ToolProfileResolver["resolveSnapshot"]>>> = {};
    const grindingCuttingConditionsByFeatureId: Record<string, GrindingResolvedCuttingConditionForFeature> = {};

    for (const feature of input.features) {
      const wheelProfileId = options.wheelProfileIdOverrideByFeatureId?.[feature.id] ?? feature.wheelProfileId ?? input.wheelProfileId;
      if (wheelProfileId) {
        toolProfileSnapshotsByFeatureId[feature.id] = await this.toolProfileResolver.resolveSnapshot(wheelProfileId, tenantId, now);
      }

      // §5/§6 - `wheelSpeedMps` znovupoužívá obecný "cuttingSpeed" resolver
      // (uloženo v m/min, převedeno na m/s), `tableSpeedMmMin` znovupoužívá
      // "feed" resolver s jednotkou `mm_per_min` - žádný nový resolver
      // mechanismus, jen jiná fyzikální interpretace stejných obecných polí
      // (stejný precedens jako Fáze C/D).
      const { resolution } = await this.cuttingConditionResolverService.resolve(
        {
          tenantId,
          materialProfileId: input.materialId,
          machineProfileId: machineProfileId ?? undefined,
          toolProfileId: wheelProfileId,
          operationCategory: "grinding",
          operationSubtype: feature.subtype,
          feedUnit: "mm_per_min",
          explicitValues: {
            cuttingSpeed: feature.cuttingConditionOverride?.wheelSpeedMps !== undefined ? CuttingSpeed.ofMetersPerMinute(feature.cuttingConditionOverride.wheelSpeedMps * 60) : undefined,
            feed: feature.cuttingConditionOverride?.tableSpeedMmMin !== undefined ? FeedRate.of(feature.cuttingConditionOverride.tableSpeedMmMin, "mm_per_min") : undefined,
          },
        },
        now
      );
      grindingCuttingConditionsByFeatureId[feature.id] = {
        wheelSpeedMps: resolution.cuttingSpeed ? resolution.cuttingSpeed.value.metersPerMinute / 60 : undefined,
        wheelSpeedSource: resolution.cuttingSpeed?.source,
        tableSpeedMmMin: resolution.feed?.value.value,
        tableSpeedSource: resolution.feed?.source,
      };
    }

    return {
      ruleVersion,
      materialProfileSnapshot,
      machineProfileSnapshot: machineProfileSnapshot ?? undefined,
      toolProfileSnapshotsByFeatureId,
      grindingCuttingConditionsByFeatureId,
      calibrationProfileId: machineProfile?.calibrationProfileId,
    };
  }
}
