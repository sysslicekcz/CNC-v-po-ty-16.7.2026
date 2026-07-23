import { TenantContext } from "@/domain/services/tenant-context";
import { CalculationVarianceRepository } from "@/domain/calculation-engine/repositories/calculation-variance-repository";
import { VarianceCauseRepository } from "@/domain/calculation-engine/repositories/variance-cause-repository";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface VarianceDashboardSummary {
  /** Průměr `percentageVariance` metriky `total_time` PŘES ZNAMÉNKO - záporná
   *  hodnota znamená systematický bias "skutečnost nižší než predikce" (§21
   *  "bias" a "průměrná odchylka" jsou ze zadání DVĚ položky, ale nad stejnou
   *  jedinou uloženou veličinou v tomhle MVP je to STEJNÉ číslo - nerozlišený
   *  rozklad na "absolutní rozptyl" vs. "systematický posun" by vyžadoval
   *  novou uloženou metriku, mimo rozsah Fáze H). */
  averagePercentageVariance: number;
  medianPercentageVariance: number;
  criticalCount: number;
  totalAnalyzedCount: number;
  /** Počet analýz, PRO KAŽDOU metriku klasifikovanou "high"/"critical",
   *  seskupeno podle metriky (§21 "odchylky podle typu operace/stroje/
   *  materiálu" - Fáze G ukládá analýzu bez přímé vazby na stroj/materiál,
   *  ten se čte z `CalculationRequest.inputSnapshot`; tahle Application
   *  vrstva seskupuje jen podle METRIKY, zdokumentované zúžení rozsahu -
   *  UI k detailu stroj/materiál/pracoviště zobrazí až v `VarianceDetailPage`
   *  z konkrétní jedné analýzy, ne v agregátu). */
  countByMetric: Readonly<Record<string, number>>;
  mostFrequentConfirmedCauses: readonly { causeCode: string; count: number }[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** `GetVarianceDashboardQuery` (AP-MCE-001 Fáze H §21/§36) - čtecí agregace
 *  nad `CalculationVarianceRepository`/`VarianceCauseRepository` (Fáze G),
 *  žádný nový výpočet odchylek. */
export class GetVarianceDashboardUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly varianceRepository: CalculationVarianceRepository,
    private readonly varianceCauseRepository: VarianceCauseRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(): Promise<VarianceDashboardSummary> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationCalibrationRead, "read");

    const [analyses, causeAssignments] = await Promise.all([this.varianceRepository.listByTenant(tenantId), this.varianceCauseRepository.listByTenant(tenantId)]);

    const totalTimeVariances = analyses
      .flatMap((a) => a.metrics)
      .filter((m) => m.comparable && m.metric === "total_time")
      .map((m) => m.percentageVariance);

    const countByMetric: Record<string, number> = {};
    let criticalCount = 0;
    for (const analysis of analyses) {
      let isCritical = false;
      for (const metric of analysis.metrics) {
        if (metric.comparable && (metric.severity === "high" || metric.severity === "critical")) {
          countByMetric[metric.metric] = (countByMetric[metric.metric] ?? 0) + 1;
          if (metric.severity === "critical") isCritical = true;
        }
      }
      if (isCritical) criticalCount++;
    }

    const confirmedCauseCounts = new Map<string, number>();
    for (const assignment of causeAssignments) {
      if (assignment.status !== "confirmed" && assignment.status !== "changed") continue;
      confirmedCauseCounts.set(assignment.causeCode, (confirmedCauseCounts.get(assignment.causeCode) ?? 0) + 1);
    }
    const mostFrequentConfirmedCauses = [...confirmedCauseCounts.entries()]
      .map(([causeCode, count]) => ({ causeCode, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      averagePercentageVariance: totalTimeVariances.length > 0 ? totalTimeVariances.reduce((s, v) => s + v, 0) / totalTimeVariances.length : 0,
      medianPercentageVariance: median(totalTimeVariances),
      criticalCount,
      totalAnalyzedCount: analyses.length,
      countByMetric,
      mostFrequentConfirmedCauses,
    };
  }
}
