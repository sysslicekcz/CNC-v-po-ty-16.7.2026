import { ValidationError } from "../errors/validation-error";

export type CapabilityRequirementKind = "required" | "recommended";

export interface OperationTypeCapabilityRequirementProps {
  id: string;
  tenantId: string;
  operationTypeId: string;
  capabilityTypeId: string;
  requirement: CapabilityRequirementKind;
  expectedValue?: string | number | boolean;
}

/**
 * Vazba "typ operace X vyžaduje/doporučuje capabilitu Y" (Krok 5, zadání bod 14) -
 * jen správa vazeb, ŽÁDNÝ automatický výběr stroje ani plánovací algoritmus
 * (mimo rozsah tohoto kroku, viz zadání). Editor postupu z Kroku 4 může tuhle
 * vazbu později použít k filtrování kompatibilních strojů - v tomto kroku se
 * jen zakládá/spravuje.
 */
export class OperationTypeCapabilityRequirement {
  private constructor(private props: OperationTypeCapabilityRequirementProps) {}

  static create(props: OperationTypeCapabilityRequirementProps): OperationTypeCapabilityRequirement {
    if (!props.tenantId.trim()) {
      throw new ValidationError("OperationTypeCapabilityRequirement: 'tenantId' nesmí být prázdné.");
    }
    if (!props.operationTypeId.trim()) {
      throw new ValidationError("OperationTypeCapabilityRequirement: 'operationTypeId' nesmí být prázdné.");
    }
    if (!props.capabilityTypeId.trim()) {
      throw new ValidationError("OperationTypeCapabilityRequirement: 'capabilityTypeId' nesmí být prázdné.");
    }
    return new OperationTypeCapabilityRequirement({ ...props });
  }

  static restore(props: OperationTypeCapabilityRequirementProps): OperationTypeCapabilityRequirement {
    return new OperationTypeCapabilityRequirement({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get operationTypeId(): string {
    return this.props.operationTypeId;
  }
  get capabilityTypeId(): string {
    return this.props.capabilityTypeId;
  }
  get requirement(): CapabilityRequirementKind {
    return this.props.requirement;
  }
  get expectedValue(): string | number | boolean | undefined {
    return this.props.expectedValue;
  }

  setRequirement(requirement: CapabilityRequirementKind): void {
    this.props.requirement = requirement;
  }

  setExpectedValue(value: string | number | boolean | undefined): void {
    this.props.expectedValue = value;
  }
}
