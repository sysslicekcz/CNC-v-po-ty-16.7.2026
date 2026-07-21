import { ValidationError } from "@/domain/errors/validation-error";
import type { OperationCategory } from "../enums/operation-category";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import { ToolLifeProfile } from "./tool-life-profile";
import { ToolWearCurve } from "./tool-wear-curve";
import { ToolCuttingParameters } from "./tool-cutting-parameters";

export interface ToolProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  externalReferences: readonly ExternalReferenceSummary[];
  manufacturer?: string;
  toolTypeId: string;
  toolTypeName: string;
  catalogDesignation?: string;
  toolMaterial?: string;
  geometry?: string;
  diameterMm?: number;
  lengthMm?: number;
  usableLengthMm?: number;
  teethCount?: number;
  cornerRadiusMm?: number;
  insertType?: string;
  /** Šířka nástroje (mm), pokud je relevantní - u brusných kotoučů (AP-MCE-001
   *  Fáze E §2 "wheelWidthMm") jde o šířku obvodu kotouče; ADITIVNÍ pole nad
   *  Fázi B, `undefined` pro nástroje, kde šířka není samostatný rozměr
   *  (soustružnické/frézovací nástroje ji nepoužívají). */
  widthMm?: number;
  suitableMaterialGroupIds: readonly string[];
  supportedOperationCategories: readonly OperationCategory[];
  defaultCuttingParameters: readonly ToolCuttingParameters[];
  toolLife: ToolLifeProfile;
  toolChangeTimeSec?: number;
  price?: number;
  currency?: string;
  wearFactorCurve: ToolWearCurve;
  /** Maximální bezpečná řezná rychlost nástroje (m/min), pokud ji výrobce/
   *  tenant zná (AP-MCE-001 Fáze C §5/§7 "maxRpm nástroje, pokud existuje" /
   *  "tool max cutting speed") - ADITIVNÍ pole nad Fázi B (`undefined` pro
   *  všechny profily založené před Fází C, nic se nerozbije). Vyjádřená jako
   *  řezná rychlost, ne přímo `rpm` - skutečný otáčkový limit závisí na
   *  průměru obráběného místa, ten strategie dopočítá sama
   *  (`SpindleSpeed.fromCuttingSpeed`). */
  maxCuttingSpeedMMin?: number;
  /** Maximální doporučený posuv na zub (mm/zub), pokud ho výrobce/tenant zná
   *  (AP-MCE-001 Fáze D §5/§8 "Posuv omez: maximálním doporučeným posuvem
   *  nástroje") - ADITIVNÍ pole nad Fázi C. */
  maxFeedPerToothMm?: number;
  tenantCorrectionId?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Kalkulační read-model nástroje (AP-MCE-001 Fáze B §4) - `id === Tool.id`
 * (stejná identita, stejný důvod jako `MaterialProfile` - žádné explicitní
 * `toolId` pole v zadání na rozdíl od `MachineProfile.physicalMachineId`).
 */
export class ToolProfile {
  private readonly props: Readonly<ToolProfileProps>;

  private constructor(props: ToolProfileProps) {
    this.props = Object.freeze({
      ...props,
      externalReferences: Object.freeze([...props.externalReferences]),
      suitableMaterialGroupIds: Object.freeze([...props.suitableMaterialGroupIds]),
      supportedOperationCategories: Object.freeze([...props.supportedOperationCategories]),
      defaultCuttingParameters: Object.freeze([...props.defaultCuttingParameters]),
    });
  }

  static create(props: ToolProfileProps): ToolProfile {
    if (!props.id.trim()) throw new ValidationError("ToolProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("ToolProfile: 'tenantId' nesmí být prázdné.");
    if (!props.toolTypeId.trim()) throw new ValidationError("ToolProfile: 'toolTypeId' nesmí být prázdné.");
    if (props.diameterMm !== undefined && props.diameterMm <= 0) {
      throw new ValidationError(`ToolProfile: 'diameterMm' musí být kladné číslo, dostal jsem "${props.diameterMm}".`);
    }
    if (props.price !== undefined && (props.currency === undefined || !props.currency.trim())) {
      throw new ValidationError("ToolProfile: 'price' vyžaduje vyplněnou 'currency'.");
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("ToolProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new ToolProfile(props);
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
  get externalReferences(): readonly ExternalReferenceSummary[] {
    return this.props.externalReferences;
  }
  get manufacturer(): string | undefined {
    return this.props.manufacturer;
  }
  get toolTypeId(): string {
    return this.props.toolTypeId;
  }
  get toolTypeName(): string {
    return this.props.toolTypeName;
  }
  get catalogDesignation(): string | undefined {
    return this.props.catalogDesignation;
  }
  get toolMaterial(): string | undefined {
    return this.props.toolMaterial;
  }
  get geometry(): string | undefined {
    return this.props.geometry;
  }
  get diameterMm(): number | undefined {
    return this.props.diameterMm;
  }
  get lengthMm(): number | undefined {
    return this.props.lengthMm;
  }
  get usableLengthMm(): number | undefined {
    return this.props.usableLengthMm;
  }
  get teethCount(): number | undefined {
    return this.props.teethCount;
  }
  get cornerRadiusMm(): number | undefined {
    return this.props.cornerRadiusMm;
  }
  get insertType(): string | undefined {
    return this.props.insertType;
  }
  get widthMm(): number | undefined {
    return this.props.widthMm;
  }
  get suitableMaterialGroupIds(): readonly string[] {
    return this.props.suitableMaterialGroupIds;
  }
  get supportedOperationCategories(): readonly OperationCategory[] {
    return this.props.supportedOperationCategories;
  }
  get defaultCuttingParameters(): readonly ToolCuttingParameters[] {
    return this.props.defaultCuttingParameters;
  }
  get toolLife(): ToolLifeProfile {
    return this.props.toolLife;
  }
  get toolChangeTimeSec(): number | undefined {
    return this.props.toolChangeTimeSec;
  }
  get price(): number | undefined {
    return this.props.price;
  }
  get currency(): string | undefined {
    return this.props.currency;
  }
  get wearFactorCurve(): ToolWearCurve {
    return this.props.wearFactorCurve;
  }
  get maxCuttingSpeedMMin(): number | undefined {
    return this.props.maxCuttingSpeedMMin;
  }
  get maxFeedPerToothMm(): number | undefined {
    return this.props.maxFeedPerToothMm;
  }
  get tenantCorrectionId(): string | undefined {
    return this.props.tenantCorrectionId;
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

  withChanges(
    changes: Partial<
      Pick<
        ToolProfileProps,
        | "toolLife"
        | "wearFactorCurve"
        | "toolChangeTimeSec"
        | "price"
        | "currency"
        | "defaultCuttingParameters"
        | "suitableMaterialGroupIds"
        | "tenantCorrectionId"
      >
    >,
    updatedAt: string
  ): ToolProfile {
    return ToolProfile.create({ ...this.props, ...changes, updatedAt, recordVersion: this.props.recordVersion + 1 });
  }

  archive(archivedAt: string): ToolProfile {
    if (this.props.archivedAt) return this;
    return new ToolProfile({ ...this.props, archivedAt, updatedAt: archivedAt, recordVersion: this.props.recordVersion + 1 });
  }

  cuttingParametersFor(criteria: { operationCategory: OperationCategory; operationSubtype?: string }): ToolCuttingParameters | undefined {
    return this.props.defaultCuttingParameters.find((p) => p.matches(criteria));
  }

  supportsMaterialGroup(materialGroupId: string): boolean {
    return this.props.suitableMaterialGroupIds.length === 0 || this.props.suitableMaterialGroupIds.includes(materialGroupId);
  }

  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      siteId: this.props.siteId,
      externalReferences: this.props.externalReferences,
      manufacturer: this.props.manufacturer,
      toolTypeId: this.props.toolTypeId,
      toolTypeName: this.props.toolTypeName,
      catalogDesignation: this.props.catalogDesignation,
      toolMaterial: this.props.toolMaterial,
      geometry: this.props.geometry,
      diameterMm: this.props.diameterMm,
      lengthMm: this.props.lengthMm,
      usableLengthMm: this.props.usableLengthMm,
      teethCount: this.props.teethCount,
      cornerRadiusMm: this.props.cornerRadiusMm,
      insertType: this.props.insertType,
      widthMm: this.props.widthMm,
      suitableMaterialGroupIds: this.props.suitableMaterialGroupIds,
      supportedOperationCategories: this.props.supportedOperationCategories,
      defaultCuttingParameters: this.props.defaultCuttingParameters.map((p) => p.toJSON()),
      toolLife: this.props.toolLife.toJSON(),
      toolChangeTimeSec: this.props.toolChangeTimeSec,
      price: this.props.price,
      currency: this.props.currency,
      wearFactorCurve: this.props.wearFactorCurve.toJSON(),
      maxCuttingSpeedMMin: this.props.maxCuttingSpeedMMin,
      maxFeedPerToothMm: this.props.maxFeedPerToothMm,
      tenantCorrectionId: this.props.tenantCorrectionId,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
