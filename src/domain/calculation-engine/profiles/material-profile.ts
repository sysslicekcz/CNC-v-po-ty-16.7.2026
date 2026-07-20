import { ValidationError } from "@/domain/errors/validation-error";
import { MaterialCuttingRecommendation, MaterialCuttingRecommendationProps } from "./material-cutting-recommendation";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";

/** Odkud profil vznikl (AP-MCE-001 Fáze B §2). `"system"` = seedovaný
 *  výchozí profil (immutable pro tenanta - viz `MaterialCorrection`),
 *  `"tenant"` = tenant si materiál založil sám od nuly, `"imported"` = vznikl
 *  ze skutečného ERP importu (viz `dataSource`/`externalReferences`). */
export type MaterialProfileSourceType = "system" | "tenant" | "imported";

export interface MaterialProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  sourceType: MaterialProfileSourceType;
  name: string;
  standard?: string;
  designation?: string;
  materialGroupId: string;
  materialGroupName: string;
  hardness?: number;
  /** Stupnice, ve které je `hardness` vyjádřená (HB/HRC/HV/...) - Krok 5
   *  `Material.hardness` žádnou stupnici nerozlišuje, `MaterialProfile` ji
   *  nese navíc jako kalkulačně relevantní upřesnění. */
  hardnessScale?: string;
  tensileStrengthMpa?: number;
  densityKgM3?: number;
  /** 0..1 - jak dobře se materiál obrábí (1 = referenční/nejlépe obrobitelný). */
  machinabilityIndex?: number;
  /** Layer 2 multiplikativní koeficient (AP-MCE-001 §03) - výchozí 1. */
  materialCoefficient: number;
  recommendedCuttingSpeeds: readonly MaterialCuttingRecommendation[];
  recommendedFeeds: readonly MaterialCuttingRecommendation[];
  suitableToolTypeIds: readonly string[];
  notes?: string;
  /** Lidsky čitelný popis původu dat ("master-data:material", "import:erp",
   *  "manual"), NIKDY jméno konkrétního ERP systému jako typované pole
   *  (AP-MCE-001 Fáze B §9 - appka nesmí znát "heliosId"/"sapId"). */
  dataSource: string;
  externalReferences: readonly ExternalReferenceSummary[];
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Kalkulační read-model materiálu (AP-MCE-001 Fáze B §2) - VLASTNÍ, samostatně
 * verzovaná entita, ne živý pohled na `Material` z master dat. `id` je
 * ZÁMĚRNĚ shodné s `Material.id` (stejná identita - profil je kalkulační
 * PROJEKCE konkrétního materiálu, ne druhý nezávislý katalog) - viz
 * `MaterialProfileFactory.createFromMaterial`. Jakmile profil jednou vznikne,
 * žije dál nezávisle na pozdějších změnách `Material` (stejný důvod jako
 * `CalculationSnapshot`, ADR 0006 - "stabilní read-model", ne živý join).
 *
 * Immutable po vytvoření - jakákoliv změna (`withCorrection`, `archive`, ...)
 * vrací NOVOU instanci s vyšším `recordVersion`.
 */
export class MaterialProfile {
  private readonly props: Readonly<MaterialProfileProps>;

  private constructor(props: MaterialProfileProps) {
    this.props = Object.freeze({
      ...props,
      recommendedCuttingSpeeds: Object.freeze([...props.recommendedCuttingSpeeds]),
      recommendedFeeds: Object.freeze([...props.recommendedFeeds]),
      suitableToolTypeIds: Object.freeze([...props.suitableToolTypeIds]),
      externalReferences: Object.freeze([...props.externalReferences]),
    });
  }

  static create(props: MaterialProfileProps): MaterialProfile {
    if (!props.id.trim()) throw new ValidationError("MaterialProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("MaterialProfile: 'tenantId' nesmí být prázdné.");
    if (!props.name.trim()) throw new ValidationError("MaterialProfile: 'name' nesmí být prázdné.");
    if (!props.materialGroupId.trim()) throw new ValidationError("MaterialProfile: 'materialGroupId' nesmí být prázdné.");
    if (!Number.isFinite(props.materialCoefficient) || props.materialCoefficient <= 0) {
      throw new ValidationError(`MaterialProfile: 'materialCoefficient' musí být kladné číslo, dostal jsem "${props.materialCoefficient}".`);
    }
    if (props.machinabilityIndex !== undefined && (props.machinabilityIndex < 0 || props.machinabilityIndex > 1)) {
      throw new ValidationError("MaterialProfile: 'machinabilityIndex' musí být v rozsahu 0..1.");
    }
    if (!props.dataSource.trim()) throw new ValidationError("MaterialProfile: 'dataSource' nesmí být prázdný.");
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("MaterialProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new MaterialProfile(props);
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get siteId(): string | undefined {
    return this.props.siteId;
  }
  get sourceType(): MaterialProfileSourceType {
    return this.props.sourceType;
  }
  get name(): string {
    return this.props.name;
  }
  get standard(): string | undefined {
    return this.props.standard;
  }
  get designation(): string | undefined {
    return this.props.designation;
  }
  get materialGroupId(): string {
    return this.props.materialGroupId;
  }
  get materialGroupName(): string {
    return this.props.materialGroupName;
  }
  get hardness(): number | undefined {
    return this.props.hardness;
  }
  get hardnessScale(): string | undefined {
    return this.props.hardnessScale;
  }
  get tensileStrengthMpa(): number | undefined {
    return this.props.tensileStrengthMpa;
  }
  get densityKgM3(): number | undefined {
    return this.props.densityKgM3;
  }
  get machinabilityIndex(): number | undefined {
    return this.props.machinabilityIndex;
  }
  get materialCoefficient(): number {
    return this.props.materialCoefficient;
  }
  get recommendedCuttingSpeeds(): readonly MaterialCuttingRecommendation[] {
    return this.props.recommendedCuttingSpeeds;
  }
  get recommendedFeeds(): readonly MaterialCuttingRecommendation[] {
    return this.props.recommendedFeeds;
  }
  get suitableToolTypeIds(): readonly string[] {
    return this.props.suitableToolTypeIds;
  }
  get notes(): string | undefined {
    return this.props.notes;
  }
  get dataSource(): string {
    return this.props.dataSource;
  }
  get externalReferences(): readonly ExternalReferenceSummary[] {
    return this.props.externalReferences;
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

  /** Vrací NOVOU instanci se zvýšeným `recordVersion` - použití: `Update
   *  MaterialProfileUseCase`. Nikdy nemutuje `this`. */
  withChanges(
    changes: Partial<
      Pick<
        MaterialProfileProps,
        | "name"
        | "standard"
        | "designation"
        | "hardness"
        | "hardnessScale"
        | "tensileStrengthMpa"
        | "densityKgM3"
        | "machinabilityIndex"
        | "materialCoefficient"
        | "recommendedCuttingSpeeds"
        | "recommendedFeeds"
        | "suitableToolTypeIds"
        | "notes"
      >
    >,
    updatedAt: string
  ): MaterialProfile {
    return MaterialProfile.create({ ...this.props, ...changes, updatedAt, recordVersion: this.props.recordVersion + 1 });
  }

  archive(archivedAt: string): MaterialProfile {
    if (this.props.archivedAt) return this;
    return new MaterialProfile({ ...this.props, archivedAt, updatedAt: archivedAt, recordVersion: this.props.recordVersion + 1 });
  }

  /** Nejlepší doporučená řezná rychlost pro danou kombinaci, `undefined`,
   *  pokud profil žádnou nemá (volající pak sáhne na systémový default -
   *  viz `CuttingConditionResolver`). */
  bestCuttingSpeedFor(criteria: { operationCategory: MaterialCuttingRecommendationProps["operationCategory"]; machiningSubtype?: string; toolMaterial?: string }): MaterialCuttingRecommendation | undefined {
    return this.props.recommendedCuttingSpeeds.filter((r) => r.matches(criteria)).sort((a, b) => b.confidence - a.confidence)[0];
  }

  bestFeedFor(criteria: { operationCategory: MaterialCuttingRecommendationProps["operationCategory"]; machiningSubtype?: string; toolMaterial?: string }): MaterialCuttingRecommendation | undefined {
    return this.props.recommendedFeeds.filter((r) => r.matches(criteria)).sort((a, b) => b.confidence - a.confidence)[0];
  }

  /** Plochá, čistě datová projekce - použití: `MaterialProfileSnapshot`,
   *  IndexedDB mapování. Ne `toJSON`/`fromJSON` pár jako u hodnotových
   *  objektů (Fáze A) - rekonstrukce zpět na `MaterialProfile` jde přes
   *  `MaterialProfile.create(...)` se stejným tvarem polí, mapper to dělá
   *  explicitně (stejná konvence jako `Machine`/`Material` mappery). */
  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      siteId: this.props.siteId,
      sourceType: this.props.sourceType,
      name: this.props.name,
      standard: this.props.standard,
      designation: this.props.designation,
      materialGroupId: this.props.materialGroupId,
      materialGroupName: this.props.materialGroupName,
      hardness: this.props.hardness,
      hardnessScale: this.props.hardnessScale,
      tensileStrengthMpa: this.props.tensileStrengthMpa,
      densityKgM3: this.props.densityKgM3,
      machinabilityIndex: this.props.machinabilityIndex,
      materialCoefficient: this.props.materialCoefficient,
      recommendedCuttingSpeeds: this.props.recommendedCuttingSpeeds.map((r) => r.toJSON()),
      recommendedFeeds: this.props.recommendedFeeds.map((r) => r.toJSON()),
      suitableToolTypeIds: this.props.suitableToolTypeIds,
      notes: this.props.notes,
      dataSource: this.props.dataSource,
      externalReferences: this.props.externalReferences,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
