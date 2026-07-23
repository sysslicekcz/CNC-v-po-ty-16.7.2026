import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationEngine } from "@/domain/calculation-engine/services/calculation-engine";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";
import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";
import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";
import { ManualOperationCalculationInput } from "@/domain/calculation-engine/manual/manual-operation-calculation-input";
import { InspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { TurningCalculationContextBuilderPort } from "../../turning/turning-calculation-context-builder";
import { MillingCalculationContextBuilderPort } from "../../milling/milling-calculation-context-builder";
import { GrindingCalculationContextBuilderPort } from "../../grinding/grinding-calculation-context-builder";
import { ManualOperationCalculationContextBuilderPort } from "../../manual/manual-operation-calculation-context-builder";
import { InspectionCalculationContextBuilderPort } from "../../inspection/inspection-calculation-context-builder";

export type PreviewCalculationInput =
  | TurningCalculationInput
  | MillingCalculationInput
  | GrindingCalculationInput
  | ManualOperationCalculationInput
  | InspectionCalculationInput;

export interface PreviewCalculationOutput {
  blocked: boolean;
  strategyVersion: string;
  breakdown?: Record<string, unknown>;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  issues: readonly CalculationIssue[];
}

const CATEGORY_FEATURE_CODE: Record<string, FeatureCode> = {
  turning: FeatureCodes.CalculationTurning,
  milling: FeatureCodes.CalculationMilling,
  grinding: FeatureCodes.CalculationGrinding,
  manual: FeatureCodes.CalculationManual,
  inspection: FeatureCodes.CalculationInspection,
};

/**
 * `PreviewCalculationUseCase` (AP-MCE-001 Fáze H §6 "Průběžný náhled nesmí
 * vytvářet oficiální CalculationResult") - zavolá STEJNOU `CalculationEngine`/
 * `CalculationStrategy` jako oficiální `Calculate*OperationUseCase` (§4/§6 -
 * "NEVYTVÁŘEJ NOVÝ VÝPOČETNÍ ENGINE"), jen výsledek NIKAM neuloží (žádné
 * `CalculationRequest`/`CalculationResult`, žádná událost). Kontext (profily/
 * pravidla) se sestavuje přes STEJNÝ `*CalculationContextBuilder` jako
 * ostrá kalkulace - jediný rozdíl je "needs 'read', not 'write'" a absence
 * repository zápisů.
 */
export class PreviewCalculationUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly turningContextBuilder: TurningCalculationContextBuilderPort,
    private readonly millingContextBuilder: MillingCalculationContextBuilderPort,
    private readonly grindingContextBuilder: GrindingCalculationContextBuilderPort,
    private readonly manualContextBuilder: ManualOperationCalculationContextBuilderPort,
    private readonly inspectionContextBuilder: InspectionCalculationContextBuilderPort,
    private readonly calculationEngine: CalculationEngine,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: PreviewCalculationInput): Promise<PreviewCalculationOutput> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    const categoryFeature = CATEGORY_FEATURE_CODE[input.operationCategory];
    if (categoryFeature) await this.featureAccessService.require(categoryFeature, "read");

    const context = await this.buildContext(input, tenantId);
    const outcome = this.calculationEngine.calculate(input, context);

    return {
      blocked: outcome.blocked,
      strategyVersion: outcome.strategyVersion,
      breakdown: outcome.breakdown?.toJSON(),
      totalOperationTimeMinutes: outcome.breakdown?.totalOperationTime.minutes,
      confidenceScore: outcome.breakdown?.turningDetail?.confidenceScore ?? outcome.breakdown?.millingDetail?.confidenceScore ?? outcome.breakdown?.grindingDetail?.confidenceScore ?? outcome.breakdown?.manualDetail?.confidenceScore ?? outcome.breakdown?.inspectionDetail?.confidenceScore,
      issues: outcome.issues,
    };
  }

  /** `operationCategory` NENÍ literálově typovaný diskriminátor na žádném z
   *  pěti `*CalculationInput` (žádný z nich `OperationCalculationInputBase.
   *  operationCategory: OperationCategory` nepřepisuje užším literálem, viz
   *  Fáze C-F) - TypeScript proto union nedokáže zúžit jen porovnáním
   *  hodnoty. Runtime hodnota `operationCategory` PŘESTO jednoznačně určuje
   *  konkrétní podtyp (volající vrstva - `NewCalculationWizard`/formulář -
   *  vždy sestaví input pro přesně JEDNU zvolenou strategii), přetypování
   *  tady je proto bezpečné zúžení podle runtime tagu, ne obejití kontroly. */
  private buildContext(input: PreviewCalculationInput, tenantId: string) {
    switch (input.operationCategory) {
      case "turning":
        return this.turningContextBuilder.build(input as TurningCalculationInput, tenantId);
      case "milling":
        return this.millingContextBuilder.build(input as MillingCalculationInput, tenantId);
      case "grinding":
        return this.grindingContextBuilder.build(input as GrindingCalculationInput, tenantId);
      case "manual":
        return this.manualContextBuilder.build(input as ManualOperationCalculationInput, tenantId);
      case "inspection":
        return this.inspectionContextBuilder.build(input as InspectionCalculationInput, tenantId);
      default:
        throw new Error(`PreviewCalculationUseCase: kategorie "${input.operationCategory}" nemá dostupný náhled.`);
    }
  }
}
