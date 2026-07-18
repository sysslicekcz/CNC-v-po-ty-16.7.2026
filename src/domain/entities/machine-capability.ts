import { ValidationError } from "../errors/validation-error";

/** Verzovaný, typovaný "JSON" pro budoucí limity capability (např. max. rozměr) -
 *  bez zásahu do databázového schématu, ale ne nevalidovaný libovolný `any`. */
export interface CapabilityLimitations {
  schemaVersion: number;
  values: Record<string, string | number | boolean>;
}

export interface MachineCapabilityProps {
  id: string;
  machineId: string;
  operationTypeId: string;
  enabled: boolean;
  priority?: number;
  limitations?: CapabilityLimitations;
}

/** Který typ operace daný stroj umí provádět - nahrazuje dnešní ploché
 *  Machine.operace: string[]. Vlastní jednoduchý agregát (vlastní
 *  MachineCapabilityRepository), ne vnitřní kolekce Machine - řídí se/dotazuje
 *  samostatně. `enabled` umožňuje capabilitu dočasně vypnout beze smazání záznamu
 *  (např. stroj dočasně bez daného nástrojového vybavení). */
export class MachineCapability {
  private constructor(private props: MachineCapabilityProps) {}

  static create(props: MachineCapabilityProps): MachineCapability {
    if (!props.machineId.trim()) throw new ValidationError("MachineCapability: 'machineId' nesmí být prázdné.");
    if (!props.operationTypeId.trim()) {
      throw new ValidationError("MachineCapability: 'operationTypeId' nesmí být prázdné.");
    }
    return new MachineCapability({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get machineId(): string {
    return this.props.machineId;
  }
  get operationTypeId(): string {
    return this.props.operationTypeId;
  }
  get enabled(): boolean {
    return this.props.enabled;
  }
  get priority(): number | undefined {
    return this.props.priority;
  }
  get limitations(): CapabilityLimitations | undefined {
    return this.props.limitations;
  }

  setEnabled(enabled: boolean): void {
    this.props.enabled = enabled;
  }
}
