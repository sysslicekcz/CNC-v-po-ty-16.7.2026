import { ValidationError } from "../errors/validation-error";

export interface MachineCapabilityValueProps {
  id: string;
  tenantId: string;
  machineId: string;
  capabilityTypeId: string;
  value: string | number | boolean;
}

/**
 * Hodnota jedné technické vlastnosti (`CapabilityType`) na konkrétním stroji
 * (Krok 5, zadání bod 10-11) - např. stroj `m-1` má `MAX_TURNING_DIAMETER` =
 * `450`. NENÍ totéž jako existující `MachineCapability` (ta odpovídá na "umí
 * stroj typ operace X", tahle na "jaká je hodnota vlastnosti X na stroji").
 * Vlastní jednoduchý agregát (vlastní repository), stejný vzor jako
 * `MachineCapability`. Validaci hodnoty proti `CapabilityType.valueType`/
 * `allowedValues` dělá use case PŘED uložením (`CapabilityType.validateValue`),
 * entita samotná typ hodnoty nezná (nedrží referenci na `CapabilityType`).
 */
export class MachineCapabilityValue {
  private constructor(private props: MachineCapabilityValueProps) {}

  static create(props: MachineCapabilityValueProps): MachineCapabilityValue {
    if (!props.tenantId.trim()) throw new ValidationError("MachineCapabilityValue: 'tenantId' nesmí být prázdné.");
    if (!props.machineId.trim()) throw new ValidationError("MachineCapabilityValue: 'machineId' nesmí být prázdné.");
    if (!props.capabilityTypeId.trim()) {
      throw new ValidationError("MachineCapabilityValue: 'capabilityTypeId' nesmí být prázdné.");
    }
    return new MachineCapabilityValue({ ...props });
  }

  static restore(props: MachineCapabilityValueProps): MachineCapabilityValue {
    return new MachineCapabilityValue({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get machineId(): string {
    return this.props.machineId;
  }
  get capabilityTypeId(): string {
    return this.props.capabilityTypeId;
  }
  get value(): string | number | boolean {
    return this.props.value;
  }

  setValue(value: string | number | boolean): void {
    this.props.value = value;
  }
}
