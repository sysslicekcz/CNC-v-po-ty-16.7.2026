import { CalculationContext, MillingResolvedCuttingConditionForFeature } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { MaterialProfileResolver } from "../resolvers/material-profile-resolver";
import { ToolProfileResolver } from "../resolvers/tool-profile-resolver";
import { CuttingConditionResolverService } from "../resolvers/cutting-condition-resolver-service";

/** Zúžený tvar `MillingCalculationContextBuilder` (jen `build`), na kterém
 *  závisí use casy - stejný důvod jako Fáze C `TurningCalculationContext
 *  BuilderPort`. */
export type MillingCalculationContextBuilderPort = Pick<MillingCalculationContextBuilder, "build">;

export interface BuildMillingCalculationContextOptions {
  /** Přepis `MachineProfile.id` pro tenhle výpočet (§15 "CompareMilling
   *  MachinesUseCase ... nahradit pouze MachineProfile"). */
  machineProfileIdOverride?: string;
  /** Přepis `ToolProfile.id` PRO KONKRÉTNÍ feature (§15 "CompareMillingTools
   *  UseCase" analogicky). */
  toolProfileIdOverrideByFeatureId?: Readonly<Record<string, string>>;
}

/**
 * `MillingCalculationContextBuilder` (AP-MCE-001 Fáze D §1/§6) -
 * Application-vrstvá služba, KTERÁ SMÍ volat repozitáře (na rozdíl od
 * `MillingCalculationStrategy`, co je čistá). Stejná struktura jako Fáze C
 * `TurningCalculationContextBuilder` - `materialProfileSnapshot`/
 * `machineProfileSnapshot` (JEDEN pro celou operaci), `toolProfileSnapshotsBy
 * FeatureId`/`millingCuttingConditionsByFeatureId` (PO JEDNOM na
 * `MillingFeature`).
 */
export class MillingCalculationContextBuilder {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly materialProfileResolver: MaterialProfileResolver,
    private readonly machineProfileRepository: MachineProfileRepository,
    private readonly toolProfileResolver: ToolProfileResolver,
    private readonly cuttingConditionResolverService: CuttingConditionResolverService
  ) {}

  async build(input: MillingCalculationInput, tenantId: string, options: BuildMillingCalculationContextOptions = {}): Promise<CalculationContext> {
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
    const millingCuttingConditionsByFeatureId: Record<string, MillingResolvedCuttingConditionForFeature> = {};

    for (const feature of input.features) {
      const toolProfileId = options.toolProfileIdOverrideByFeatureId?.[feature.id] ?? feature.toolProfileId;
      if (toolProfileId) {
        toolProfileSnapshotsByFeatureId[feature.id] = await this.toolProfileResolver.resolveSnapshot(toolProfileId, tenantId, now);
      }

      const { resolution } = await this.cuttingConditionResolverService.resolve(
        {
          tenantId,
          materialProfileId: input.materialId,
          machineProfileId: machineProfileId ?? undefined,
          toolProfileId,
          operationCategory: "milling",
          operationSubtype: feature.subtype,
          feedUnit: "mm_per_tooth",
          explicitValues: {
            cuttingSpeed: feature.cuttingConditionOverride?.cuttingSpeedMMin !== undefined ? CuttingSpeed.ofMetersPerMinute(feature.cuttingConditionOverride.cuttingSpeedMMin) : undefined,
            feed: feature.cuttingConditionOverride?.feedPerToothMm !== undefined ? FeedRate.of(feature.cuttingConditionOverride.feedPerToothMm, "mm_per_tooth") : undefined,
          },
        },
        now
      );
      millingCuttingConditionsByFeatureId[feature.id] = {
        cuttingSpeedMMin: resolution.cuttingSpeed?.value.metersPerMinute,
        cuttingSpeedSource: resolution.cuttingSpeed?.source,
        cuttingSpeedConfidence: resolution.cuttingSpeed?.confidence,
        feedPerToothMm: resolution.feed?.value.value,
        feedSource: resolution.feed?.source,
        feedConfidence: resolution.feed?.confidence,
      };
    }

    return {
      ruleVersion,
      materialProfileSnapshot,
      machineProfileSnapshot: machineProfileSnapshot ?? undefined,
      toolProfileSnapshotsByFeatureId,
      millingCuttingConditionsByFeatureId,
      calibrationProfileId: machineProfile?.calibrationProfileId,
    };
  }
}
