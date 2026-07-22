import { ValidationError } from "@/domain/errors/validation-error";
import type { VarianceMetric } from "./variance-tolerance-profile";

/** AP-MCE-001 Fáze G §10 - sedmnáct skupin příčin odchylek. */
export type VarianceCauseGroup =
  | "input_data"
  | "material"
  | "machine"
  | "tool"
  | "setup"
  | "operator"
  | "geometry"
  | "method"
  | "inspection"
  | "waiting"
  | "downtime"
  | "rework"
  | "quality"
  | "logistics"
  | "planning"
  | "external"
  | "unknown";

/** AP-MCE-001 Fáze G §10 - uzavřený katalog konkrétních příčin ze zadání
 *  ("Příklady důvodů") - MVP bere tenhle seznam jako uzavřený, ne jen
 *  příkladový, ať `VarianceCauseClassifier` má nad čím rozhodovat
 *  deterministicky (nový kód = vědomé rozšíření katalogu, ne volný text). */
export type VarianceCauseCode =
  | "wrong_quantity"
  | "incorrect_setup_time"
  | "incorrect_cutting_condition"
  | "tool_wear"
  | "excessive_tool_changes"
  | "machine_condition"
  | "machine_breakdown"
  | "material_variation"
  | "excessive_allowance"
  | "missing_tool"
  | "missing_fixture"
  | "operator_learning"
  | "operator_interruption"
  | "quality_rework"
  | "waiting_for_crane"
  | "waiting_for_material"
  | "waiting_for_inspection"
  | "unplanned_measurement"
  | "incorrect_feature_geometry"
  | "inaccurate_path_estimation"
  | "three_d_approximation"
  | "manual_time_estimate_inaccurate"
  | "sampling_plan_difference"
  | "unknown";

export interface VarianceCause {
  code: VarianceCauseCode;
  group: VarianceCauseGroup;
  label: string;
}

/** JEDNO místo, které váže `VarianceCauseCode` na jeho `VarianceCauseGroup`
 *  a lidsky čitelný popisek - `VarianceCauseClassifier` i `AssignVariance
 *  CauseUseCase` čtou odsud, ne ze svého vlastního výčtu. */
export const VARIANCE_CAUSE_CATALOG: Record<VarianceCauseCode, VarianceCause> = {
  wrong_quantity: { code: "wrong_quantity", group: "input_data", label: "Nesprávné zadané množství" },
  incorrect_setup_time: { code: "incorrect_setup_time", group: "setup", label: "Nesprávně odhadnutý čas seřízení" },
  incorrect_cutting_condition: { code: "incorrect_cutting_condition", group: "method", label: "Nesprávná řezná podmínka" },
  tool_wear: { code: "tool_wear", group: "tool", label: "Opotřebení nástroje" },
  excessive_tool_changes: { code: "excessive_tool_changes", group: "tool", label: "Nadměrný počet výměn nástroje" },
  machine_condition: { code: "machine_condition", group: "machine", label: "Stav/kondice stroje" },
  machine_breakdown: { code: "machine_breakdown", group: "machine", label: "Porucha stroje" },
  material_variation: { code: "material_variation", group: "material", label: "Odchylka vlastností materiálu" },
  excessive_allowance: { code: "excessive_allowance", group: "method", label: "Nadměrný přídavek na obrábění" },
  missing_tool: { code: "missing_tool", group: "tool", label: "Chybějící nástroj" },
  missing_fixture: { code: "missing_fixture", group: "setup", label: "Chybějící přípravek" },
  operator_learning: { code: "operator_learning", group: "operator", label: "Zaučování obsluhy" },
  operator_interruption: { code: "operator_interruption", group: "operator", label: "Přerušení práce obsluhy" },
  quality_rework: { code: "quality_rework", group: "rework", label: "Přepracování kvůli kvalitě" },
  waiting_for_crane: { code: "waiting_for_crane", group: "waiting", label: "Čekání na jeřáb" },
  waiting_for_material: { code: "waiting_for_material", group: "waiting", label: "Čekání na materiál" },
  waiting_for_inspection: { code: "waiting_for_inspection", group: "waiting", label: "Čekání na kontrolu" },
  unplanned_measurement: { code: "unplanned_measurement", group: "inspection", label: "Neplánované měření" },
  incorrect_feature_geometry: { code: "incorrect_feature_geometry", group: "geometry", label: "Nesprávná geometrie prvku" },
  inaccurate_path_estimation: { code: "inaccurate_path_estimation", group: "method", label: "Nepřesný odhad dráhy nástroje" },
  three_d_approximation: { code: "three_d_approximation", group: "geometry", label: "Aproximace 3D geometrie" },
  manual_time_estimate_inaccurate: { code: "manual_time_estimate_inaccurate", group: "method", label: "Nepřesný odhad ručního času" },
  sampling_plan_difference: { code: "sampling_plan_difference", group: "inspection", label: "Odlišný sampling plán" },
  unknown: { code: "unknown", group: "unknown", label: "Neznámá příčina" },
};

export type VarianceCauseAssignmentStatus = "suggested" | "confirmed" | "rejected" | "changed" | "user_added";

export interface VarianceCauseAssignmentProps {
  id: string;
  tenantId: string;
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  causeCode: VarianceCauseCode;
  /** §10 "Classifier ... nesmí své závěry vydávat za jistotu" - `create()`
   *  vynucuje horní strop < 1 pro `status === "suggested"`. */
  confidence: number;
  evidence: readonly string[];
  affectedMetrics: readonly VarianceMetric[];
  recommendation?: string;
  classificationVersion: string;
  status: VarianceCauseAssignmentStatus;
  createdAt: string;
  updatedAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

/**
 * `VarianceCauseAssignment` (AP-MCE-001 Fáze G §10) - vazba JEDNÉ navržené/
 * potvrzené příčiny na konkrétní odchylku. Uživatel ji smí potvrdit/odmítnout/
 * změnit/doplnit (§10) - každá akce vrací NOVOU instanci (immutable, stejná
 * disciplína jako zbytek modulu).
 */
export class VarianceCauseAssignment {
  private readonly props: Readonly<VarianceCauseAssignmentProps>;

  private constructor(props: VarianceCauseAssignmentProps) {
    this.props = Object.freeze({ ...props, evidence: Object.freeze([...props.evidence]), affectedMetrics: Object.freeze([...props.affectedMetrics]) });
  }

  static create(props: VarianceCauseAssignmentProps): VarianceCauseAssignment {
    if (!props.id.trim()) throw new ValidationError("VarianceCauseAssignment: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("VarianceCauseAssignment: 'tenantId' nesmí být prázdné.");
    if (!Number.isFinite(props.confidence) || props.confidence < 0 || props.confidence > 1) {
      throw new ValidationError("VarianceCauseAssignment: 'confidence' musí být v rozsahu 0..1.");
    }
    if (props.status === "suggested" && props.confidence >= 1) {
      throw new ValidationError("VarianceCauseAssignment: navržená (nepotvrzená) příčina nesmí mít 'confidence' rovnou 1 (§10 'nesmí vydávat za jistotu').");
    }
    return new VarianceCauseAssignment(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get calculationId(): string {
    return this.props.calculationId;
  }
  get calculationRevision(): number {
    return this.props.calculationRevision;
  }
  get actualTimeRecordId(): string {
    return this.props.actualTimeRecordId;
  }
  get causeCode(): VarianceCauseCode {
    return this.props.causeCode;
  }
  get confidence(): number {
    return this.props.confidence;
  }
  get evidence(): readonly string[] {
    return this.props.evidence;
  }
  get affectedMetrics(): readonly VarianceMetric[] {
    return this.props.affectedMetrics;
  }
  get recommendation(): string | undefined {
    return this.props.recommendation;
  }
  get classificationVersion(): string {
    return this.props.classificationVersion;
  }
  get status(): VarianceCauseAssignmentStatus {
    return this.props.status;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }
  get confirmedBy(): string | undefined {
    return this.props.confirmedBy;
  }
  get confirmedAt(): string | undefined {
    return this.props.confirmedAt;
  }

  confirm(confirmedBy: string, confirmedAt: string): VarianceCauseAssignment {
    return new VarianceCauseAssignment({ ...this.props, status: "confirmed", confidence: 1, confirmedBy, confirmedAt, updatedAt: confirmedAt });
  }

  reject(rejectedBy: string, rejectedAt: string): VarianceCauseAssignment {
    return new VarianceCauseAssignment({ ...this.props, status: "rejected", confirmedBy: rejectedBy, confirmedAt: rejectedAt, updatedAt: rejectedAt });
  }

  changeCause(newCauseCode: VarianceCauseCode, changedBy: string, changedAt: string): VarianceCauseAssignment {
    return new VarianceCauseAssignment({ ...this.props, causeCode: newCauseCode, status: "changed", confidence: 1, confirmedBy: changedBy, confirmedAt: changedAt, updatedAt: changedAt });
  }

  toPlainObject(): Record<string, unknown> {
    return { ...this.props, evidence: [...this.props.evidence], affectedMetrics: [...this.props.affectedMetrics] };
  }
}
