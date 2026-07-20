import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";

/**
 * Jeden zaznamenaný požadavek na výpočet (AP-MCE-001 §09: "Full input snapshot
 * for one operation calculation", immutable, auditovaný). `inputSnapshot` je
 * ZÁMĚRNĚ `Readonly<Record<string, unknown>>`, ne `OperationCalculationInput`
 * (ten je Application-vrstvé DTO, `application/calculation-engine/dto/`) -
 * Domain nesmí importovat z Application (opačný směr závislosti je zakázaný,
 * stejně jako "application vrstva neimportuje nic z infrastructure" už dnes
 * hlídá `architecture-tests`). Přesně tenhle vzor už appka používá u
 * existujícího `CalculationEngine.compute(calculationType, inputParameters:
 * unknown, ...)` portu (`domain/services/calculation-engine.ts`) - konkrétní
 * tvar vstupu rozhoduje volající vrstva, doména ho jen nese a zamrzne.
 *
 * `ruleVersionId` je nepovinné na vstupu (AP-MCE-001 §12: "omitted = current
 * active"), ale jakmile Application vrstva zjistí AKTIVNÍ verzi pravidel,
 * zapíše ji sem - `CalculationRequest` už nikdy nenese "current active" jako
 * hodnotu, jen konkrétní id (reprodukovatelnost, AP-MCE-001 §15).
 */
export interface CalculationRequestProps {
  id: string;
  tenantId: string;
  operationCategory: OperationCategory;
  operationTypeId: string;
  idempotencyKey: string;
  inputSnapshot: Record<string, unknown>;
  ruleVersionId: string;
  requestedAt: string; // ISO 8601
  requestedBy?: string;
}

export class CalculationRequest {
  private readonly props: Readonly<CalculationRequestProps>;

  private constructor(props: CalculationRequestProps) {
    this.props = Object.freeze({
      ...props,
      inputSnapshot: Object.freeze({ ...props.inputSnapshot }),
    });
  }

  static create(props: CalculationRequestProps): CalculationRequest {
    if (!props.id.trim()) throw new ValidationError("CalculationRequest: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("CalculationRequest: 'tenantId' nesmí být prázdné.");
    if (!props.operationTypeId.trim()) throw new ValidationError("CalculationRequest: 'operationTypeId' nesmí být prázdné.");
    if (!props.idempotencyKey.trim()) throw new ValidationError("CalculationRequest: 'idempotencyKey' nesmí být prázdný.");
    if (!props.ruleVersionId.trim()) throw new ValidationError("CalculationRequest: 'ruleVersionId' nesmí být prázdné.");
    return new CalculationRequest(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get operationCategory(): OperationCategory {
    return this.props.operationCategory;
  }
  get operationTypeId(): string {
    return this.props.operationTypeId;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get inputSnapshot(): Readonly<Record<string, unknown>> {
    return this.props.inputSnapshot;
  }
  get ruleVersionId(): string {
    return this.props.ruleVersionId;
  }
  get requestedAt(): string {
    return this.props.requestedAt;
  }
  get requestedBy(): string | undefined {
    return this.props.requestedBy;
  }
}
