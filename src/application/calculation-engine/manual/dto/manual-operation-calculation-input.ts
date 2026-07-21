import { ManualOperationCalculationInput as DomainManualOperationCalculationInput } from "@/domain/calculation-engine/manual/manual-operation-calculation-input";

/** Application DTO - stejný vzor jako Fáze C/D/E. */
export interface ManualOperationCalculationInput extends DomainManualOperationCalculationInput {
  idempotencyKey: string;
  requestedBy?: string;
  actorId?: string;
  correlationId?: string;
}
