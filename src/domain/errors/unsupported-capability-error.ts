import { DomainError } from "./domain-error";

/** Zdroj (stroj) nepodporuje požadovaný typ operace - viz MachineCapability. */
export class UnsupportedCapabilityError extends DomainError {
  constructor(machineId: string, operationTypeId: string) {
    super(`Stroj "${machineId}" nepodporuje typ operace "${operationTypeId}".`);
  }
}
