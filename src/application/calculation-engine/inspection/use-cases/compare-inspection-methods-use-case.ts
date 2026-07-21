import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationStrategyRegistry } from "@/domain/calculation-engine/services/calculation-strategy-registry";
import { InspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { InspectionCalculationContextBuilderPort } from "../inspection-calculation-context-builder";

/** Jedna porovnávaná metoda (§17 "porovná například ruční měření a CMM") -
 *  KAŽDÁ metoda nese VLASTNÍ `InspectionCalculationInput` (jiné vybavení,
 *  jiný sampling plán, ...), stejná dávka (`quantity`) se typicky opakuje
 *  napříč kandidáty, aby porovnání dávalo smysl. */
export interface InspectionMethodCandidate {
  label: string;
  input: InspectionCalculationInput;
}

export interface CompareInspectionMethodsInput {
  candidates: InspectionMethodCandidate[];
}

export interface InspectionMethodComparisonRow {
  label: string;
  totalOperationTimeMin: number;
  /** §17 "čas zařízení" - strojní cyklus + nastavení vybavení. */
  equipmentTimeMin: number;
  /** §17 "čas obsluhy" - manipulace + přítomnost obsluhy u vybavení. */
  operatorTimeMin: number;
  setupTimeMin: number;
  reportTimeMin: number;
  confidenceScore: number;
  warnings: CalculationIssue[];
}

export interface InspectionMethodComparisonResult {
  rows: InspectionMethodComparisonRow[];
}

/**
 * `CompareInspectionMethodsUseCase` (AP-MCE-001 Fáze F §17) - spustí
 * `InspectionCalculationStrategy.calculate()` pro KAŽDÉHO kandidáta zvlášť
 * (stejná strategie, jiný vstup/kontext) a porovná výsledky vedle sebe -
 * použití: "vyplatí se přejít z ručního měření na CMM?".
 */
export class CompareInspectionMethodsUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly strategyRegistry: CalculationStrategyRegistry,
    private readonly contextBuilder: InspectionCalculationContextBuilderPort,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CompareInspectionMethodsInput): Promise<InspectionMethodComparisonResult> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationRead, "read");
    await this.featureAccessService.require(FeatureCodes.CalculationInspection, "read");

    const strategy = this.strategyRegistry.resolve("inspection");
    const rows: InspectionMethodComparisonRow[] = [];

    for (const candidate of input.candidates) {
      const context = await this.contextBuilder.build(candidate.input, tenantId);
      const issues = strategy.validate(candidate.input, context);
      if (issues.some((i) => i.severity === "error")) {
        rows.push({
          label: candidate.label,
          totalOperationTimeMin: Number.POSITIVE_INFINITY,
          equipmentTimeMin: 0,
          operatorTimeMin: 0,
          setupTimeMin: 0,
          reportTimeMin: 0,
          confidenceScore: 0,
          warnings: issues,
        });
        continue;
      }

      const breakdown = strategy.calculate(candidate.input, context);
      const detail = breakdown.inspectionDetail;
      rows.push({
        label: candidate.label,
        totalOperationTimeMin: detail?.totalOperationTimeMin ?? breakdown.totalOperationTime.minutes,
        equipmentTimeMin: (detail?.automaticCycleTimeMin ?? 0) + (detail?.equipmentSetupTimeMin ?? 0),
        operatorTimeMin: (detail?.operatorAttendanceTimeMin ?? 0) + (detail?.handlingTimeMin ?? 0),
        setupTimeMin: detail?.equipmentSetupTimeMin ?? 0,
        reportTimeMin: detail?.reportTimeMin ?? 0,
        confidenceScore: detail?.confidenceScore ?? 1,
        warnings: detail?.warnings ?? [],
      });
    }

    rows.sort((a, b) => a.totalOperationTimeMin - b.totalOperationTimeMin);
    return { rows };
  }
}
