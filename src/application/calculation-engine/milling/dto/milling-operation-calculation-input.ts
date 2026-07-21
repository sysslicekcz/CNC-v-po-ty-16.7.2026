import { MillingCalculationInput } from "@/domain/calculation-engine/milling/milling-calculation-input";

/** Application DTO - stejný vzor jako Fáze C `TurningOperationCalculation
 *  Input` (obálka požadavku nad doménovým vstupem: idempotence, kdo žádá). */
export interface MillingOperationCalculationInput extends MillingCalculationInput {
  idempotencyKey: string;
  requestedBy?: string;
  actorId?: string;
  correlationId?: string;
}
