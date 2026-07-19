import { ValidationError } from "../errors/validation-error";
import { MasterDataStatus } from "./master-data-status";

export type CapabilityValueType = "boolean" | "number" | "text" | "selection";

export interface CapabilityTypeProps {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  valueType: CapabilityValueType;
  unit?: string;
  allowedValues?: string[];
  status: MasterDataStatus;
}

/**
 * Registr TECHNICKÝCH vlastností stroje (Krok 5, zadání bod 11) - např.
 * `MAX_TURNING_DIAMETER` (number, mm), `LIVE_TOOLING` (boolean). NENÍ totéž co
 * existující `MachineCapability` (ten říká "stroj umí typ operace X", ne "stroj
 * má vlastnost Y s hodnotou Z") - viz docs/audits/step-5-audit.md a
 * docs/adr/machine-capabilities-use-explicit-types.md. Hodnoty na konkrétním
 * stroji nese `MachineCapabilityValue`, ne tahle třída.
 */
export class CapabilityType {
  private constructor(private props: CapabilityTypeProps) {}

  static create(props: CapabilityTypeProps): CapabilityType {
    if (!props.tenantId.trim()) throw new ValidationError("CapabilityType: 'tenantId' nesmí být prázdné.");
    if (!props.code.trim()) throw new ValidationError("CapabilityType: 'code' nesmí být prázdný.");
    if (!props.name.trim()) throw new ValidationError("CapabilityType: 'name' nesmí být prázdný.");
    if (props.valueType === "selection" && (!props.allowedValues || props.allowedValues.length === 0)) {
      throw new ValidationError("CapabilityType: typ 'selection' vyžaduje neprázdný 'allowedValues'.");
    }
    return new CapabilityType({ ...props });
  }

  static restore(props: CapabilityTypeProps): CapabilityType {
    return new CapabilityType({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get valueType(): CapabilityValueType {
    return this.props.valueType;
  }
  get unit(): string | undefined {
    return this.props.unit;
  }
  get allowedValues(): readonly string[] | undefined {
    return this.props.allowedValues;
  }
  get status(): MasterDataStatus {
    return this.props.status;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("CapabilityType: 'name' nesmí být prázdný.");
    this.props.name = name;
  }

  updateDetails(input: { unit?: string; allowedValues?: string[] }): void {
    if (input.unit !== undefined) this.props.unit = input.unit || undefined;
    if (input.allowedValues !== undefined) this.props.allowedValues = input.allowedValues;
  }

  setStatus(status: MasterDataStatus): void {
    this.props.status = status;
  }

  /** Validuje jednu hodnotu proti `valueType`/`allowedValues` - použito
   *  `MachineCapabilityValue` use casy PŘED uložením (zadání bod 63 -
   *  "validace jednotky/typu"). Vrací chybovou zprávu, nebo `null` (validní). */
  validateValue(value: string | number | boolean): string | null {
    if (this.props.valueType === "boolean" && typeof value !== "boolean") {
      return `Hodnota capability "${this.props.name}" musí být boolean.`;
    }
    if (this.props.valueType === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      return `Hodnota capability "${this.props.name}" musí být konečné číslo.`;
    }
    if (this.props.valueType === "text" && typeof value !== "string") {
      return `Hodnota capability "${this.props.name}" musí být text.`;
    }
    if (this.props.valueType === "selection") {
      if (typeof value !== "string" || !(this.props.allowedValues ?? []).includes(value)) {
        return `Hodnota capability "${this.props.name}" musí být jedna z povolených možností.`;
      }
    }
    return null;
  }
}
