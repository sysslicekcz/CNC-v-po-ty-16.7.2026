import { CalculationContext } from "@/domain/calculation-engine/contracts/calculation-context";
import { RuleRepository } from "@/domain/calculation-engine/repositories/rule-repository";
import { ManualTimeStandardRepository } from "@/domain/calculation-engine/repositories/manual-time-standard-repository";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { ManualOperationCalculationInput } from "@/domain/calculation-engine/manual/manual-operation-calculation-input";
import { ManualTimeProfileSnapshot } from "@/domain/calculation-engine/manual/manual-time-profile-snapshot";
import { resolveManualTimeStandard } from "@/domain/calculation-engine/manual/manual-time-standard-resolver";
import { syntheticManualFeatures } from "@/domain/calculation-engine/manual/manual-synthetic-features";

/** Zúžený tvar `ManualOperationCalculationContextBuilder` (jen `build`), na
 *  kterém závisí use casy - stejný důvod jako Fáze C/D/E `*ContextBuilderPort`. */
export type ManualOperationCalculationContextBuilderPort = Pick<ManualOperationCalculationContextBuilder, "build">;

/**
 * `ManualOperationCalculationContextBuilder` (AP-MCE-001 Fáze F §5) -
 * Application-vrstvá služba, KTERÁ SMÍ volat repozitáře (`ManualOperation
 * CalculationStrategy` sama zůstává čistá funkce, viz komentář u `Calculation
 * Context.manualTimeStandardsByFeatureId`). Pro každý feature s `timeBasis
 * !== "explicit"` najde kandidáty (`ManualTimeStandardRepository.find
 * Candidates`) a rozhodne mezi nimi (`resolveManualTimeStandard`, čistá
 * funkce, Domain) - výsledný snapshot uloží podle `feature.id`.
 */
export class ManualOperationCalculationContextBuilder {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly manualTimeStandardRepository: ManualTimeStandardRepository
  ) {}

  async build(input: ManualOperationCalculationInput, tenantId: string): Promise<CalculationContext> {
    const now = new Date().toISOString();

    const ruleVersion = input.ruleVersionId
      ? await this.ruleRepository.findById(input.ruleVersionId, tenantId)
      : await this.ruleRepository.findActiveVersion(tenantId);
    if (!ruleVersion) {
      throw new CalculationError(
        input.ruleVersionId ? `Verze pravidel "${input.ruleVersionId}" nebyla nalezena.` : `Pro organizaci "${tenantId}" není nastavená žádná aktivní verze výpočtových pravidel.`
      );
    }

    const manualTimeStandardsByFeatureId: Record<string, ManualTimeProfileSnapshot> = {};
    for (const feature of syntheticManualFeatures(input)) {
      if (feature.timeBasis === "explicit") continue;
      const candidates = await this.manualTimeStandardRepository.findCandidates(feature.subtype, tenantId);
      const { standard } = resolveManualTimeStandard({ candidates, complexityLevel: feature.complexityLevel, now });
      if (standard) {
        manualTimeStandardsByFeatureId[feature.id] = ManualTimeProfileSnapshot.forManualTimeStandard(standard, { createdAt: now });
      }
    }

    return {
      ruleVersion,
      manualTimeStandardsByFeatureId,
    };
  }
}
