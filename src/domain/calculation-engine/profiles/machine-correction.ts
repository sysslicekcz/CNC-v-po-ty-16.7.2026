import { ValidationError } from "@/domain/errors/validation-error";
import { MachineSetupTimeProfile } from "./machine-setup-time-profile";

/** Zákaznická korekce nad systémovým/tovární `MachineProfile` (AP-MCE-001
 *  Fáze B §3, stejný overlay princip jako `MaterialCorrection`) - jen
 *  koeficienty a seřizovací časy, NIKDY identita/limity stroje (`maxRpm`,
 *  `workEnvelope`, ...) - ty popisují fyzický stroj, ne tenantovu zkušenost
 *  s ním. */
export interface MachineCorrectionProps {
  id: string;
  tenantId: string;
  machineProfileId: string;
  powerCoefficient?: number;
  ageCoefficient?: number;
  conditionCoefficient?: number;
  typicalSetupTimes?: readonly MachineSetupTimeProfile[];
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export class MachineCorrection {
  private readonly props: Readonly<MachineCorrectionProps>;

  private constructor(props: MachineCorrectionProps) {
    this.props = Object.freeze({
      ...props,
      typicalSetupTimes: props.typicalSetupTimes ? Object.freeze([...props.typicalSetupTimes]) : undefined,
    });
  }

  static create(props: MachineCorrectionProps): MachineCorrection {
    if (!props.id.trim()) throw new ValidationError("MachineCorrection: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("MachineCorrection: 'tenantId' nesmí být prázdné.");
    if (!props.machineProfileId.trim()) throw new ValidationError("MachineCorrection: 'machineProfileId' nesmí být prázdné.");
    if (!props.reason.trim()) throw new ValidationError("MachineCorrection: 'reason' nesmí být prázdný.");
    for (const [name, value] of Object.entries({
      powerCoefficient: props.powerCoefficient,
      ageCoefficient: props.ageCoefficient,
      conditionCoefficient: props.conditionCoefficient,
    })) {
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        throw new ValidationError(`MachineCorrection: '${name}' musí být kladné číslo.`);
      }
    }
    return new MachineCorrection(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get machineProfileId(): string {
    return this.props.machineProfileId;
  }
  get powerCoefficient(): number | undefined {
    return this.props.powerCoefficient;
  }
  get ageCoefficient(): number | undefined {
    return this.props.ageCoefficient;
  }
  get conditionCoefficient(): number | undefined {
    return this.props.conditionCoefficient;
  }
  get typicalSetupTimes(): readonly MachineSetupTimeProfile[] | undefined {
    return this.props.typicalSetupTimes;
  }
  get reason(): string {
    return this.props.reason;
  }
  get createdBy(): string | undefined {
    return this.props.createdBy;
  }
  get recordVersion(): number {
    return this.props.recordVersion;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get updatedAt(): string {
    return this.props.updatedAt;
  }
  get archivedAt(): string | undefined {
    return this.props.archivedAt;
  }
  get isArchived(): boolean {
    return this.props.archivedAt !== undefined;
  }

  /** Plochá datová projekce - použití: návratová DTO hodnota use casů, stejná
   *  konvence jako `MachineProfile.toPlainObject`. */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      machineProfileId: this.props.machineProfileId,
      powerCoefficient: this.props.powerCoefficient,
      ageCoefficient: this.props.ageCoefficient,
      conditionCoefficient: this.props.conditionCoefficient,
      typicalSetupTimes: this.props.typicalSetupTimes?.map((s) => s.toJSON()),
      reason: this.props.reason,
      createdBy: this.props.createdBy,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
