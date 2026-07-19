import { ConflictError } from "./conflict-error";

/** Stejná trojice `[externalSystemId, externalEntityType, externalId]` už má
 *  existující ExternalReference - unikátnost se posuzuje jen uvnitř JEDNOHO
 *  externího systému, ne globálně (stejné externí id smí nezávisle existovat
 *  ve dvou různých systémech). */
export class DuplicateExternalReferenceError extends ConflictError {
  constructor(
    readonly externalSystemId: string,
    readonly externalEntityType: string,
    readonly externalId: string
  ) {
    super(
      `Reference na externí entitu "${externalEntityType}" s id "${externalId}" v systému "${externalSystemId}" už existuje.`
    );
  }
}
