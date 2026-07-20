import { ValidationError } from "@/domain/errors/validation-error";
import { computeContentChecksum } from "../shared/checksum";
import { CuttingConditionResolution } from "./cutting-condition-resolver";

/**
 * Immutable snapshot výsledku `resolveCuttingConditions()` (AP-MCE-001 Fáze B
 * §10) - na rozdíl od `MaterialProfileSnapshot`/`MachineProfileSnapshot`/
 * `ToolProfileSnapshot` (které zamrazují JEDEN profil) tenhle zamrazuje
 * VÝSLEDEK RESOLVERU (`cuttingSpeed`/`feed` mohou každý pocházet z jiného
 * zdroje/verze pravidla) - proto nededí `ProfileSnapshot` (jiný tvar dat), ale
 * sdílí stejný checksum mechanismus a stejnou záruku: `CalculationResult`
 * uložený s tímto snapshotem se nikdy nezmění, když se později změní
 * `CuttingCondition`/`MaterialProfile`/`ToolProfile` záznamy, ze kterých byl
 * spočítán.
 */
export interface CuttingConditionSnapshotProps {
  tenantId: string;
  materialProfileId: string;
  machineProfileId?: string;
  toolProfileId?: string;
  resolvedData: Readonly<Record<string, unknown>>;
  createdAt: string;
  checksum: string;
}

export class CuttingConditionSnapshot {
  private readonly props: Readonly<CuttingConditionSnapshotProps>;

  private constructor(props: CuttingConditionSnapshotProps) {
    this.props = Object.freeze({ ...props, resolvedData: Object.freeze({ ...props.resolvedData }) });
  }

  static forResolution(
    resolution: CuttingConditionResolution,
    context: {
      tenantId: string;
      materialProfileId: string;
      machineProfileId?: string;
      toolProfileId?: string;
      createdAt: string;
    }
  ): CuttingConditionSnapshot {
    if (!context.tenantId.trim()) throw new ValidationError("CuttingConditionSnapshot: 'tenantId' nesmí být prázdné.");
    if (!context.materialProfileId.trim()) {
      throw new ValidationError("CuttingConditionSnapshot: 'materialProfileId' nesmí být prázdné.");
    }
    const resolvedData: Record<string, unknown> = {
      cuttingSpeed: resolution.cuttingSpeed
        ? {
            metersPerMinute: resolution.cuttingSpeed.value.metersPerMinute,
            source: resolution.cuttingSpeed.source,
            confidence: resolution.cuttingSpeed.confidence,
            sourceRecordId: resolution.cuttingSpeed.sourceRecordId,
          }
        : undefined,
      feed: resolution.feed
        ? {
            value: resolution.feed.value.value,
            unit: resolution.feed.value.unit,
            source: resolution.feed.source,
            confidence: resolution.feed.confidence,
            sourceRecordId: resolution.feed.sourceRecordId,
          }
        : undefined,
      issues: resolution.issues,
    };
    const checksum = computeContentChecksum(resolvedData);
    return new CuttingConditionSnapshot({
      tenantId: context.tenantId,
      materialProfileId: context.materialProfileId,
      machineProfileId: context.machineProfileId,
      toolProfileId: context.toolProfileId,
      resolvedData: Object.freeze(resolvedData),
      createdAt: context.createdAt,
      checksum,
    });
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
  get materialProfileId(): string {
    return this.props.materialProfileId;
  }
  get machineProfileId(): string | undefined {
    return this.props.machineProfileId;
  }
  get toolProfileId(): string | undefined {
    return this.props.toolProfileId;
  }
  get resolvedData(): Readonly<Record<string, unknown>> {
    return this.props.resolvedData;
  }
  get createdAt(): string {
    return this.props.createdAt;
  }
  get checksum(): string {
    return this.props.checksum;
  }

  matchesContent(data: Record<string, unknown>): boolean {
    return this.props.checksum === computeContentChecksum(data);
  }

  toJSON(): CuttingConditionSnapshotProps {
    return { ...this.props };
  }
}
