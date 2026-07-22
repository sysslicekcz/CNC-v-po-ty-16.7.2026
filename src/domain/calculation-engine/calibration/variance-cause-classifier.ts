import type { OperationCategory } from "../enums/operation-category";
import { CalculationVarianceAnalysis } from "./calculation-variance";
import type { VarianceMetricResult } from "./calculation-variance";
import type { VarianceMetric } from "./variance-tolerance-profile";
import type { VarianceCauseCode } from "./variance-cause";

export const CLASSIFIER_VERSION = "variance-cause-classifier-1.0.0";
/** §10 "Classifier ... nesmí své závěry vydávat za jistotu" - žádný návrh
 *  klasifikátoru nikdy nepřesáhne tenhle strop, ani při shodě víc pravidel. */
const MAX_SUGGESTION_CONFIDENCE = 0.75;

export interface VarianceCauseSuggestion {
  causeCode: VarianceCauseCode;
  confidence: number;
  evidence: readonly string[];
  affectedMetrics: readonly VarianceMetric[];
  recommendation: string;
  classificationVersion: string;
}

export interface ClassifyVarianceCausesContext {
  operationCategory: OperationCategory;
  waitingTimeMin: number;
  downtimeMin: number;
  reworkTimeMin: number;
  batchTimeMin: number;
}

function metricOf(analysis: CalculationVarianceAnalysis, metric: VarianceMetric): VarianceMetricResult | undefined {
  return analysis.metrics.find((m) => m.metric === metric);
}

function isNotable(metric: VarianceMetricResult | undefined): metric is VarianceMetricResult {
  return metric !== undefined && metric.comparable && (metric.severity === "high" || metric.severity === "critical");
}

/**
 * `VarianceCauseClassifier` (AP-MCE-001 Fáze G §10) - ČISTÁ, pravidlová
 * funkce (žádný nekontrolovaný ML model, §15 stejný princip aplikovaný i
 * tady) - vrací SEZNAM návrhů seřazený podle confidence, NIKDY jeden
 * "jistý" závěr. Uživatel je musí potvrdit/odmítnout/změnit/doplnit (§10) -
 * tahle funkce jen NAVRHUJE, nikdy sama nezapisuje `VarianceCauseAssignment`.
 */
export function classifyVarianceCauses(analysis: CalculationVarianceAnalysis, context: ClassifyVarianceCausesContext): VarianceCauseSuggestion[] {
  const suggestions: VarianceCauseSuggestion[] = [];

  const setup = metricOf(analysis, "setup");
  if (isNotable(setup) && setup.direction === "actual_higher") {
    suggestions.push({
      causeCode: "incorrect_setup_time",
      confidence: 0.6,
      evidence: [`setup: skutečnost o ${setup.percentageVariance.toFixed(1)} % vyšší než predikce (${setup.severity}).`],
      affectedMetrics: ["setup"],
      recommendation: "Zkontrolujte odhad seřizovacího času standardu/šablony.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  const machine = metricOf(analysis, "machine_time");
  if (isNotable(machine)) {
    if (machine.direction === "actual_higher") {
      suggestions.push({
        causeCode: "tool_wear",
        confidence: 0.5,
        evidence: [`machine_time: skutečnost o ${machine.percentageVariance.toFixed(1)} % vyšší než predikce (${machine.severity}).`],
        affectedMetrics: ["machine_time"],
        recommendation: "Ověřte opotřebení nástroje a použitou řeznou podmínku.",
        classificationVersion: CLASSIFIER_VERSION,
      });
      suggestions.push({
        causeCode: "material_variation",
        confidence: 0.4,
        evidence: [`machine_time: skutečnost o ${machine.percentageVariance.toFixed(1)} % vyšší než predikce (${machine.severity}).`],
        affectedMetrics: ["machine_time"],
        recommendation: "Ověřte odchylku vlastností materiálu od katalogové hodnoty.",
        classificationVersion: CLASSIFIER_VERSION,
      });
    } else {
      suggestions.push({
        causeCode: "excessive_allowance",
        confidence: 0.35,
        evidence: [`machine_time: skutečnost o ${Math.abs(machine.percentageVariance).toFixed(1)} % nižší než predikce (${machine.severity}).`],
        affectedMetrics: ["machine_time"],
        recommendation: "Zkontrolujte přídavek na obrábění použitý ve výpočtu.",
        classificationVersion: CLASSIFIER_VERSION,
      });
    }
  }

  const toolChange = metricOf(analysis, "tool_change");
  if (isNotable(toolChange) && toolChange.direction === "actual_higher") {
    suggestions.push({
      causeCode: "excessive_tool_changes",
      confidence: 0.55,
      evidence: [`tool_change: skutečnost o ${toolChange.percentageVariance.toFixed(1)} % vyšší než predikce (${toolChange.severity}).`],
      affectedMetrics: ["tool_change"],
      recommendation: "Ověřte skutečný počet výměn nástroje oproti plánovanému.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  const inspection = metricOf(analysis, "inspection");
  if (isNotable(inspection) && inspection.direction === "actual_higher") {
    const causeCode: VarianceCauseCode = context.operationCategory === "inspection" ? "sampling_plan_difference" : "unplanned_measurement";
    suggestions.push({
      causeCode,
      confidence: 0.5,
      evidence: [`inspection: skutečnost o ${inspection.percentageVariance.toFixed(1)} % vyšší než predikce (${inspection.severity}).`],
      affectedMetrics: ["inspection"],
      recommendation: "Porovnejte skutečně použitý sampling plán/rozsah měření s predikcí.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  const unitTime = metricOf(analysis, "unit_time");
  if (isNotable(unitTime) && context.operationCategory === "manual") {
    suggestions.push({
      causeCode: "manual_time_estimate_inaccurate",
      confidence: 0.5,
      evidence: [`unit_time: odchylka ${unitTime.percentageVariance.toFixed(1)} % (${unitTime.severity}) u ruční operace.`],
      affectedMetrics: ["unit_time"],
      recommendation: "Zvažte vytvoření/aktualizaci ManualTimeStandard pro tenhle podtyp.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  if (context.batchTimeMin > 0 && context.waitingTimeMin / context.batchTimeMin > 0.1) {
    suggestions.push({
      causeCode: "waiting_for_material",
      confidence: 0.3,
      evidence: [`waitingTimeMin ${context.waitingTimeMin.toFixed(1)} min (${((context.waitingTimeMin / context.batchTimeMin) * 100).toFixed(0)} % doby dávky).`],
      affectedMetrics: ["total_time", "batch_time"],
      recommendation: "Zjistěte konkrétní důvod čekání u obsluhy (materiál/jeřáb/kontrola).",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  if (context.batchTimeMin > 0 && context.downtimeMin / context.batchTimeMin > 0.05) {
    suggestions.push({
      causeCode: "machine_breakdown",
      confidence: 0.4,
      evidence: [`downtimeMin ${context.downtimeMin.toFixed(1)} min (${((context.downtimeMin / context.batchTimeMin) * 100).toFixed(0)} % doby dávky).`],
      affectedMetrics: ["total_time", "batch_time"],
      recommendation: "Ověřte, zda šlo o poruchu, nebo plánovanou údržbu.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  if (context.reworkTimeMin > 0) {
    suggestions.push({
      causeCode: "quality_rework",
      confidence: 0.5,
      evidence: [`reworkTimeMin ${context.reworkTimeMin.toFixed(1)} min.`],
      affectedMetrics: ["total_time", "batch_time"],
      recommendation: "Ověřte příčinu neshody, která vyvolala přepracování.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      causeCode: "unknown",
      confidence: 0.2,
      evidence: ["Žádné pravidlo klasifikátoru neodpovídalo naměřeným odchylkám."],
      affectedMetrics: [],
      recommendation: "Vyžaduje ruční posouzení.",
      classificationVersion: CLASSIFIER_VERSION,
    });
  }

  return suggestions.map((s) => ({ ...s, confidence: Math.min(s.confidence, MAX_SUGGESTION_CONFIDENCE) })).sort((a, b) => b.confidence - a.confidence);
}
