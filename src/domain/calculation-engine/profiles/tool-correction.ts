import { ValidationError } from "@/domain/errors/validation-error";
import { ToolLifeProfile } from "./tool-life-profile";
import { ToolWearCurve } from "./tool-wear-curve";
import { ToolCuttingParameters } from "./tool-cutting-parameters";

/** Zákaznická korekce nad systémovým/tovární `ToolProfile` (AP-MCE-001 Fáze
 *  B §4) - stejný overlay princip jako `MaterialCorrection`/`MachineCorrection`. */
export interface ToolCorrectionProps {
  id: string;
  tenantId: string;
  toolProfileId: string;
  toolLife?: ToolLifeProfile;
  wearFactorCurve?: ToolWearCurve;
  toolChangeTimeSec?: number;
  defaultCuttingParameters?: readonly ToolCuttingParameters[];
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export class ToolCorrection {
  private readonly props: Readonly<ToolCorrectionProps>;

  private constructor(props: ToolCorrectionProps) {
    this.props = Object.freeze({
      ...props,
      defaultCuttingParameters: props.defaultCuttingParameters ? Object.freeze([...props.defaultCuttingParameters]) : undefined,
    });
  }

  static create(props: ToolCorrectionProps): ToolCorrection {
    if (!props.id.trim()) throw new ValidationError("ToolCorrection: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ToolCorrection: 'tenantId' nesmí být prázdné.");
    if (!props.toolProfileId.trim()) throw new ValidationError("ToolCorrection: 'toolProfileId' nesmí být prázdné.");
    if (!props.reason.trim()) throw new ValidationError("ToolCorrection: 'reason' nesmí být prázdný.");
    return new ToolCorrection(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get toolProfileId(): string {
    return this.props.toolProfileId;
  }
  get toolLife(): ToolLifeProfile | undefined {
    return this.props.toolLife;
  }
  get wearFactorCurve(): ToolWearCurve | undefined {
    return this.props.wearFactorCurve;
  }
  get toolChangeTimeSec(): number | undefined {
    return this.props.toolChangeTimeSec;
  }
  get defaultCuttingParameters(): readonly ToolCuttingParameters[] | undefined {
    return this.props.defaultCuttingParameters;
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
   *  konvence jako `ToolProfile.toPlainObject`. */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      toolProfileId: this.props.toolProfileId,
      toolLife: this.props.toolLife?.toJSON(),
      wearFactorCurve: this.props.wearFactorCurve?.toJSON(),
      toolChangeTimeSec: this.props.toolChangeTimeSec,
      defaultCuttingParameters: this.props.defaultCuttingParameters?.map((p) => p.toJSON()),
      reason: this.props.reason,
      createdBy: this.props.createdBy,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
