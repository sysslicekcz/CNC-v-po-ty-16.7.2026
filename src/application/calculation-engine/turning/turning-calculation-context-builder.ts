import { CalculationContext, TurningResolvedCuttingConditionForFeature } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { MachineProfileRepository } from "@/domain/calculation-engine/repositories/machine-profile-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { CuttingSpeed } from "@/domain/calculation-engine/value-objects/cutting-speed";
import { FeedRate } from "@/domain/calculation-engine/value-objects/feed-rate";
import { MaterialProfileResolver } from "../resolvers/material-profile-resolver";
import { ToolProfileResolver } from "../resolvers/tool-profile-resolver";
import { CuttingConditionResolverService } from "../resolvers/cutting-condition-resolver-service";

export interface BuildTurningCalculationContextOptions {
  /** Přepis `MachineProfile.id` pro tenhle výpočet, MÍSTO dohledání podle
   *  `input.machineId` (§14 "CompareTurningMachinesUseCase ... nahradit
   *  pouze MachineProfile" - stejný technologický vstup, jiný stroj). */
  machineProfileIdOverride?: string;
  /** Přepis `ToolProfile.id` PRO KONKRÉTNÍ feature, MÍSTO `feature.
   *  toolProfileId` (§14 "CompareTurningToolsUseCase" analogicky). */
  toolProfileIdOverrideByFeatureId?: Readonly<Record<string, string>>;
}

/**
 * `TurningCalculationContextBuilder` (AP-MCE-001 Fáze C §1/§6) - Application-
 * vrstvá služba, KTERÁ SMÍ volat repozitáře (na rozdíl od `TurningCalculation
 * Strategy`, co je čistá - viz její komentář). Sestaví `CalculationContext`
 * přesně tak, jak ho `TurningCalculationStrategy` očekává: `materialProfile
 * Snapshot`/`machineProfileSnapshot` (JEDEN pro celou operaci), `toolProfile
 * SnapshotsByFeatureId`/`turningCuttingConditionsByFeatureId` (PO JEDNOM na
 * `TurningFeature`, protože různé featury mohou používat různé nástroje -
 * viz komentáře u `CalculationContext`).
 *
 * `MaterialProfile.id === Material.id` a `ToolProfile.id === Tool.id` (Fáze B
 * rozhodnutí), takže `input.materialId`/`feature.toolProfileId` fungují jako
 * profil id PŘÍMO. `MachineProfile.id` je ZÁMĚRNĚ jiné než `Machine.id`
 * (`physicalMachineId`), proto se stroj dohledává přes `listByTenant` +
 * filtr na `physicalMachineId === input.machineId` - žádná nová repozitářová
 * metoda kvůli tomu nevzniká (§7 "minimální metody" zůstávají beze změny),
 * filtr v JS je stejná konvence jako zbytek appky (`findByCode` apod.).
 */
export class TurningCalculationContextBuilder {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly materialProfileResolver: MaterialProfileResolver,
    private readonly machineProfileRepository: MachineProfileRepository,
    private readonly toolProfileResolver: ToolProfileResolver,
    private readonly cuttingConditionResolverService: CuttingConditionResolverService
  ) {}

  async build(input: TurningCalculationInput, tenantId: string, options: BuildTurningCalculationContextOptions = {}): Promise<CalculationContext> {
    const now = new Date().toISOString();

    const ruleVersion = input.ruleVersionId
      ? await this.ruleRepository.findById(input.ruleVersionId, tenantId)
      : await this.ruleRepository.findActiveVersion(tenantId);
    if (!ruleVersion) {
      throw new CalculationError(
        input.ruleVersionId
          ? `Verze pravidel "${input.ruleVersionId}" nebyla nalezena.`
          : `Pro organizaci "${tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
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
    const turningCuttingConditionsByFeatureId: Record<string, TurningResolvedCuttingConditionForFeature> = {};

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
          operationCategory: "turning",
          operationSubtype: feature.subtype,
          feedUnit: "mm_per_rev",
          explicitValues: {
            cuttingSpeed:
              feature.cuttingConditionOverride?.cuttingSpeedMMin !== undefined
                ? CuttingSpeed.ofMetersPerMinute(feature.cuttingConditionOverride.cuttingSpeedMMin)
                : undefined,
            feed:
              feature.cuttingConditionOverride?.feedPerRevolutionMm !== undefined
                ? FeedRate.of(feature.cuttingConditionOverride.feedPerRevolutionMm, "mm_per_rev")
                : undefined,
          },
        },
        now
      );
      turningCuttingConditionsByFeatureId[feature.id] = {
        cuttingSpeedMMin: resolution.cuttingSpeed?.value.metersPerMinute,
        cuttingSpeedSource: resolution.cuttingSpeed?.source,
        cuttingSpeedConfidence: resolution.cuttingSpeed?.confidence,
        feedPerRevolutionMm: resolution.feed?.value.value,
        feedSource: resolution.feed?.source,
        feedConfidence: resolution.feed?.confidence,
      };
    }

    return {
      ruleVersion,
      materialProfileSnapshot,
      machineProfileSnapshot: machineProfileSnapshot ?? undefined,
      toolProfileSnapshotsByFeatureId,
      turningCuttingConditionsByFeatureId,
      calibrationProfileId: machineProfile?.calibrationProfileId,
    };
  }
}
