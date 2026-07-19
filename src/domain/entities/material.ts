import { ValidationError } from "../errors/validation-error";
import { MaterialCode } from "../value-objects/material-code";
import { MasterDataStatus } from "./master-data-status";

export interface MaterialProps {
  id: string;
  tenantId: string;
  code: MaterialCode;
  name: string;
  materialGroupId: string;
  standard?: string;
  designation?: string;
  densityKgPerM3?: number;
  hardness?: number;
  status: MasterDataStatus;
  note?: string;
}

/**
 * Minimální materiálový záznam (Krok 5, zadání bod 22) - ŽÁDNÁ rozsáhlá databáze
 * materiálových norem. Existuje jen proto, že `ToolMachineCondition.materialId`
 * (Krok 3) na tuhle entitu už čekalo jako připravené, dosud nenaplněné pole -
 * viz docs/audits/step-5-audit.md, oddíl 7. `Part.material` (volný text)
 * zůstává NEZÁVISLÉ pole, nepřevádí se na FK sem (mimo rozsah tohoto kroku).
 */
export class Material {
  private constructor(private props: MaterialProps) {}

  static create(props: MaterialProps): Material {
    if (!props.tenantId.trim()) throw new ValidationError("Material: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("Material: 'name' nesmí být prázdný.");
    if (!props.materialGroupId.trim()) throw new ValidationError("Material: 'materialGroupId' nesmí být prázdné.");
    if (props.densityKgPerM3 !== undefined && (!Number.isFinite(props.densityKgPerM3) || props.densityKgPerM3 < 0)) {
      throw new ValidationError("Material: 'densityKgPerM3' nesmí být záporná.");
    }
    if (props.hardness !== undefined && (!Number.isFinite(props.hardness) || props.hardness < 0)) {
      throw new ValidationError("Material: 'hardness' nesmí být záporná.");
    }
    return new Material({ ...props });
  }

  static restore(props: MaterialProps): Material {
    return new Material({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get code(): MaterialCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get materialGroupId(): string {
    return this.props.materialGroupId;
  }
  get standard(): string | undefined {
    return this.props.standard;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }
  get densityKgPerM3(): number | undefined {
    return this.props.densityKgPerM3;
  }
  get hardness(): number | undefined {
    return this.props.hardness;
  }
  get status(): MasterDataStatus {
    return this.props.status;
  }
  get note(): string | undefined {
    return this.props.note;
  }

  rename(name: string): void {
    if (!name.trim()) throw new ValidationError("Material: 'name' nesmí být prázdný.");
    this.props.name = name;
  }

  updateDetails(input: {
    materialGroupId?: string;
    standard?: string;
    designation?: string;
    densityKgPerM3?: number;
    hardness?: number;
    note?: string;
  }): void {
    if (input.materialGroupId !== undefined) {
      if (!input.materialGroupId.trim()) throw new ValidationError("Material: 'materialGroupId' nesmí být prázdné.");
      this.props.materialGroupId = input.materialGroupId;
    }
    if (input.standard !== undefined) this.props.standard = input.standard || undefined;
    if (input.designation !== undefined) this.props.designation = input.designation || undefined;
    if (input.densityKgPerM3 !== undefined) {
      if (!Number.isFinite(input.densityKgPerM3) || input.densityKgPerM3 < 0) {
        throw new ValidationError("Material: 'densityKgPerM3' nesmí být záporná.");
      }
      this.props.densityKgPerM3 = input.densityKgPerM3;
    }
    if (input.hardness !== undefined) {
      if (!Number.isFinite(input.hardness) || input.hardness < 0) {
        throw new ValidationError("Material: 'hardness' nesmí být záporná.");
      }
      this.props.hardness = input.hardness;
    }
    if (input.note !== undefined) this.props.note = input.note || undefined;
  }

  setStatus(status: MasterDataStatus): void {
    this.props.status = status;
  }
}
