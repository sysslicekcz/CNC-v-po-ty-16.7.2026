import { ValidationError } from "@/domain/errors/validation-error";
import { MaterialCuttingRecommendation } from "./material-cutting-recommendation";

/**
 * Zákaznická korekce nad SYSTÉMOVÝM `MaterialProfile` (AP-MCE-001 Fáze B §2:
 * "Zákaznická korekce nesmí přepsat systémový profil"). Existuje VEDLE
 * systémového profilu jako samostatný, verzovaný záznam - nikdy ho needituje
 * na místě. Jen pole, která dává smysl korigovat (koeficient, doporučené
 * řezné podmínky, poznámka) - `name`/`standard`/`materialGroupId`/identita
 * materiálu tady záměrně NEJSOU, korekce nemůže "přejmenovat" systémový
 * materiál.
 */
export interface MaterialCorrectionProps {
  id: string;
  tenantId: string;
  materialProfileId: string;
  materialCoefficient?: number;
  recommendedCuttingSpeeds?: readonly MaterialCuttingRecommendation[];
  recommendedFeeds?: readonly MaterialCuttingRecommendation[];
  notes?: string;
  /** Proč byla korekce založena - povinné, auditní stopa (AP-MCE-001 Fáze B
   *  je v tomhle konzistentní s existujícím `ManualOverride`/`reason` z Fáze A). */
  reason: string;
  createdBy?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export class MaterialCorrection {
  private readonly props: Readonly<MaterialCorrectionProps>;

  private constructor(props: MaterialCorrectionProps) {
    this.props = Object.freeze({
      ...props,
      recommendedCuttingSpeeds: props.recommendedCuttingSpeeds ? Object.freeze([...props.recommendedCuttingSpeeds]) : undefined,
      recommendedFeeds: props.recommendedFeeds ? Object.freeze([...props.recommendedFeeds]) : undefined,
    });
  }

  static create(props: MaterialCorrectionProps): MaterialCorrection {
    if (!props.id.trim()) throw new ValidationError("MaterialCorrection: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("MaterialCorrection: 'tenantId' nesmí být prázdné.");
    if (!props.materialProfileId.trim()) throw new ValidationError("MaterialCorrection: 'materialProfileId' nesmí být prázdné.");
    if (!props.reason.trim()) throw new ValidationError("MaterialCorrection: 'reason' nesmí být prázdný.");
    if (props.materialCoefficient !== undefined && (!Number.isFinite(props.materialCoefficient) || props.materialCoefficient <= 0)) {
      throw new ValidationError("MaterialCorrection: 'materialCoefficient' musí být kladné číslo.");
    }
    return new MaterialCorrection(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get materialProfileId(): string {
    return this.props.materialProfileId;
  }
  get materialCoefficient(): number | undefined {
    return this.props.materialCoefficient;
  }
  get recommendedCuttingSpeeds(): readonly MaterialCuttingRecommendation[] | undefined {
    return this.props.recommendedCuttingSpeeds;
  }
  get recommendedFeeds(): readonly MaterialCuttingRecommendation[] | undefined {
    return this.props.recommendedFeeds;
  }
  get notes(): string | undefined {
    return this.props.notes;
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
   *  konvence jako `MaterialProfile.toPlainObject`. */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      materialProfileId: this.props.materialProfileId,
      materialCoefficient: this.props.materialCoefficient,
      recommendedCuttingSpeeds: this.props.recommendedCuttingSpeeds?.map((r) => r.toJSON()),
      recommendedFeeds: this.props.recommendedFeeds?.map((r) => r.toJSON()),
      notes: this.props.notes,
      reason: this.props.reason,
      createdBy: this.props.createdBy,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
