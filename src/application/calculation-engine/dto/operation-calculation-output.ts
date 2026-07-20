import { CalculationStatus } from "@/domain/calculation-engine/enums/calculation-status";
import { CalculationIssue } from "@/domain/calculation-engine/entities/types";

/**
 * Application DTO odpovídající response tvaru z AP-MCE-001 §12 - plochá,
 * čistě datová projekce `CalculationResult` pro volající MIMO doménu
 * (Planning Engine, ERP konektory, budoucí REST API, ...). Nikdy nenese
 * chování/metody, jen data - proto DTO, ne entita.
 *
 * `breakdown` je `CalculationBreakdown.toJSON()` (viz mapper) - stejný důvod
 * jako AP-MCE-001 §05 "Výpočet nesmí vracet pouze jedno číslo bez vysvětlení":
 * i tenhle vnější tvar musí nést celý rozpad, ne jen `totalOperationTimeMinutes`.
 */
export interface OperationCalculationOutput {
  calculationId: string;
  calculationRequestId: string;
  status: CalculationStatus;
  engineVersion: string;
  strategyVersion?: string;
  ruleVersionId: string;
  confidenceScore?: number;
  /** `undefined`, pokud `status === "failed"`. */
  breakdown?: Record<string, unknown>;
  /** Konečný čas operace v minutách - `manualOverrideMinutes`, pokud je
   *  nastavený, jinak `breakdown.totalOperationTime` (viz
   *  `CalculationResult.finalOperationTime`). `undefined` pro `"failed"`. */
  finalOperationTimeMinutes?: number;
  issues: readonly CalculationIssue[];
  calculatedAt: string;
}
