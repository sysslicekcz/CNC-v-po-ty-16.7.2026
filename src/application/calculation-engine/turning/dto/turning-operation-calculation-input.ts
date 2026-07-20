import { TurningCalculationInput } from "@/domain/calculation-engine/turning/turning-calculation-input";

/** Application DTO - viz `application/calculation-engine/dto/operation-
 *  calculation-input.ts` pro plné zdůvodnění vzoru (obálka požadavku nad
 *  doménovým vstupem: idempotence, kdo žádá). `ruleVersionId` už je součástí
 *  `TurningCalculationInput` (AP-MCE-001 Fáze C §2 "Společná pole"), tady se
 *  neduplikuje. */
export interface TurningOperationCalculationInput extends TurningCalculationInput {
  idempotencyKey: string;
  requestedBy?: string;
  actorId?: string;
  correlationId?: string;
}
