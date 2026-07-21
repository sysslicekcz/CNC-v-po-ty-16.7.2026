import { GrindingCalculationInput } from "@/domain/calculation-engine/grinding/grinding-calculation-input";

/** Application DTO - stejný vzor jako Fáze C/D. */
export interface GrindingOperationCalculationInput extends GrindingCalculationInput {
  idempotencyKey: string;
  requestedBy?: string;
  actorId?: string;
  correlationId?: string;
}
