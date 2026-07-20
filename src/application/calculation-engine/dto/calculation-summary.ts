import { CalculationStatus } from "@/domain/calculation-engine/enums/calculation-status";
import type { OperationCategory } from "@/domain/calculation-engine/enums/operation-category";

/**
 * Odlehčená projekce `CalculationResult` pro výpisové obrazovky (AP-MCE-001
 * §20 "Calculation history") - nikdy nenese celý `breakdown`, jen tolik, kolik
 * potřebuje řádek seznamu. Podrobnosti se dotáhnou přes
 * `OperationCalculationOutput`/`GET /calculations/{id}/breakdown` až po
 * kliknutí na konkrétní záznam.
 */
export interface CalculationSummary {
  calculationId: string;
  operationCategory: OperationCategory;
  operationTypeId: string;
  status: CalculationStatus;
  totalOperationTimeMinutes?: number;
  confidenceScore?: number;
  hasManualOverride: boolean;
  calculatedAt: string;
}
