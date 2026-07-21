import { ValidationError } from "@/domain/errors/validation-error";
import type { InspectionSubtype } from "./inspection-subtype";

/** AP-MCE-001 Fáze F §9 "equipmentType například" - otevřený, ale
 *  zdokumentovaný seznam (nový typ zařízení je jen nová hodnota stringu,
 *  ne změna schématu - `custom` kryje cokoliv nezařazené). */
export type EquipmentType =
  | "caliper"
  | "micrometer"
  | "bore_gauge"
  | "height_gauge"
  | "cmm"
  | "roughness_tester"
  | "hardness_tester"
  | "balancing_machine"
  | "pressure_test_bench"
  | "leak_test_bench"
  | "visual_station"
  | "custom";

/** §9 "automationLevel" - kolik z měřicího cyklu proběhne bez obsluhy (§11
 *  "Automatický strojní cyklus a čas obsluhy musí být v breakdown oddělené"). */
export type AutomationLevel = "manual" | "semi_automatic" | "automatic";

/** §9 "reportGenerationMode" - jak vzniká protokol (ovlivňuje `reportTimeMin`/
 *  `documentationCoefficient`, §10/§13). */
export type ReportGenerationMode = "manual" | "template_assisted" | "automatic";

export interface InspectionEquipmentProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  equipmentType: EquipmentType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  supportedInspectionSubtypes: readonly InspectionSubtype[];
  /** Přesnost zařízení (mm, nebo jednotka relevantní typu zařízení - MVP
   *  nerozlišuje jednotku podle `equipmentType`, stejné zjednodušení jako
   *  Fáze E `MachineProfile.positioningAccuracyMm`). */
  accuracy?: number;
  measurementRange?: { min: number; max: number };
  setupTimeMin: number;
  calibrationValidTo?: string;
  equipmentCoefficient: number;
  automationLevel: AutomationLevel;
  reportGenerationMode: ReportGenerationMode;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Kalkulační read-model kontrolního vybavení (AP-MCE-001 Fáze F §9) - stejný
 * vzor jako Fáze B `ToolProfile`/`MachineProfile` (immutable, `create()`
 * validace, `toPlainObject()` pro snapshoty/perzistenci). Samostatná entita
 * (ne `ToolProfile`) - měřidla/CMM/zkušební stolice nesou jiné vlastnosti
 * (přesnost, rozsah, kalibrace, automatizace, protokol) než řezné nástroje.
 */
export class InspectionEquipmentProfile {
  private readonly props: Readonly<InspectionEquipmentProfileProps>;

  private constructor(props: InspectionEquipmentProfileProps) {
    this.props = Object.freeze({ ...props, supportedInspectionSubtypes: Object.freeze([...props.supportedInspectionSubtypes]) });
  }

  static create(props: InspectionEquipmentProfileProps): InspectionEquipmentProfile {
    if (!props.id.trim()) throw new ValidationError("InspectionEquipmentProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("InspectionEquipmentProfile: 'tenantId' nesmí být prázdné.");
    if (props.accuracy !== undefined && props.accuracy <= 0) {
      throw new ValidationError(`InspectionEquipmentProfile: 'accuracy' musí být kladné číslo, dostal jsem "${props.accuracy}".`);
    }
    if (props.measurementRange && props.measurementRange.min > props.measurementRange.max) {
      throw new ValidationError("InspectionEquipmentProfile: 'measurementRange.min' nesmí být větší než 'measurementRange.max'.");
    }
    if (!Number.isFinite(props.setupTimeMin) || props.setupTimeMin < 0) {
      throw new ValidationError("InspectionEquipmentProfile: 'setupTimeMin' nesmí být záporné.");
    }
    if (!Number.isFinite(props.equipmentCoefficient) || props.equipmentCoefficient <= 0) {
      throw new ValidationError("InspectionEquipmentProfile: 'equipmentCoefficient' musí být kladné číslo.");
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("InspectionEquipmentProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new InspectionEquipmentProfile(props);
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
  get equipmentType(): EquipmentType {
    return this.props.equipmentType;
  }
  get manufacturer(): string | undefined {
    return this.props.manufacturer;
  }
  get model(): string | undefined {
    return this.props.model;
  }
  get serialNumber(): string | undefined {
    return this.props.serialNumber;
  }
  get supportedInspectionSubtypes(): readonly InspectionSubtype[] {
    return this.props.supportedInspectionSubtypes;
  }
  get accuracy(): number | undefined {
    return this.props.accuracy;
  }
  get measurementRange(): { min: number; max: number } | undefined {
    return this.props.measurementRange;
  }
  get setupTimeMin(): number {
    return this.props.setupTimeMin;
  }
  get calibrationValidTo(): string | undefined {
    return this.props.calibrationValidTo;
  }
  get equipmentCoefficient(): number {
    return this.props.equipmentCoefficient;
  }
  get automationLevel(): AutomationLevel {
    return this.props.automationLevel;
  }
  get reportGenerationMode(): ReportGenerationMode {
    return this.props.reportGenerationMode;
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

  /** `true`, pokud kalibrace ZNÁMÁ a k danému okamžiku VYPRŠELA (§9
   *  "platnost kalibrace") - chybějící `calibrationValidTo` se netrestá
   *  (neznámá kalibrace ≠ prokázaně neplatná, stejná zásada jako jinde). */
  isCalibrationExpiredAt(atIso: string): boolean {
    return this.props.calibrationValidTo !== undefined && this.props.calibrationValidTo < atIso;
  }

  supportsSubtype(subtype: InspectionSubtype): boolean {
    return this.props.supportedInspectionSubtypes.length === 0 || this.props.supportedInspectionSubtypes.includes(subtype);
  }

  archive(archivedAt: string): InspectionEquipmentProfile {
    if (this.props.archivedAt) return this;
    return new InspectionEquipmentProfile({ ...this.props, archivedAt, updatedAt: archivedAt, recordVersion: this.props.recordVersion + 1 });
  }

  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      siteId: this.props.siteId,
      equipmentType: this.props.equipmentType,
      manufacturer: this.props.manufacturer,
      model: this.props.model,
      serialNumber: this.props.serialNumber,
      supportedInspectionSubtypes: this.props.supportedInspectionSubtypes,
      accuracy: this.props.accuracy,
      measurementRange: this.props.measurementRange,
      setupTimeMin: this.props.setupTimeMin,
      calibrationValidTo: this.props.calibrationValidTo,
      equipmentCoefficient: this.props.equipmentCoefficient,
      automationLevel: this.props.automationLevel,
      reportGenerationMode: this.props.reportGenerationMode,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
