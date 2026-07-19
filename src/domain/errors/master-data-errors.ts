import { ConflictError } from "./conflict-error";
import { DomainError } from "./domain-error";
import { InvalidStateError } from "./invalid-state-error";
import { ValidationError } from "./validation-error";

/**
 * Sdílené chyby pro NOVÉ kmenové entity Kroku 5 (Supplier, Material,
 * MaterialGroup, CapabilityType, ToolType, OperationType, Tool) - JEDNA
 * parametrizovaná třída na chybu místo sedmi skoro identických (`MachineCode-
 * AlreadyExistsError` apod. ze staršího kódu zůstávají beze změny - vytvořit
 * jim ekvivalent pro každou novou entitu by byla přesně ta duplicita, kterou
 * zadání bod 4 zakazuje; existující specifické třídy se NEPŘEPISUJÍ, protože
 * fungují a přejmenování by bylo zbytečná churn beze zisku).
 */
export class MasterDataCodeAlreadyExistsError extends ConflictError {
  constructor(
    readonly entityName: string,
    readonly tenantId: string,
    readonly code: string
  ) {
    super(`${entityName} s kódem "${code}" už v této organizaci existuje.`);
  }
}

/** Záznam je odkazovaný jinde (RoutingSheet/Operation/MachineCapability/...) a
 *  nejde ho fyzicky smazat (zadání bod 23) - `usageSummary` je volitelný lidsky
 *  čitelný přehled ("14 technologických postupů, 8 vydaných revizí"). */
export class MasterDataInUseError extends DomainError {
  constructor(
    readonly entityName: string,
    readonly id: string,
    readonly usageSummary?: string
  ) {
    super(
      `${entityName} je používán a nelze ho odstranit.${usageSummary ? ` (${usageSummary})` : ""} Můžete ho deaktivovat.`
    );
  }
}

/** Pokus o NOVÉ přiřazení neaktivního kmenového záznamu (zadání bod 24) - už
 *  existující historické přiřazení zůstává beze změny, jen nová vazba je
 *  zakázaná. */
export class MasterDataInactiveError extends InvalidStateError {
  constructor(entityName: string, id: string) {
    super(`${entityName} "${id}" je neaktivní a nelze ho nově přiřadit.`);
  }
}

export class InvalidMasterDataValueError extends ValidationError {
  constructor(message: string) {
    super(message);
  }
}
