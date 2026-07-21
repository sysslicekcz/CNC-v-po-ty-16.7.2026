import { InspectionCalculationInput as DomainInspectionCalculationInput } from "@/domain/calculation-engine/inspection/inspection-calculation-input";

/** Application DTO - stejný vzor jako Fáze C/D/E. */
export interface InspectionOperationCalculationInput extends DomainInspectionCalculationInput {
  idempotencyKey: string;
  requestedBy?: string;
  actorId?: string;
  correlationId?: string;
}
