import { ValidationError } from "@/domain/errors/validation-error";
import type { MachineCategory } from "@/domain/entities/machine";
import { ExternalReferenceSummary } from "../shared/external-reference-summary";
import { MachineCapabilitySummary } from "../shared/machine-capability-summary";
import { MachineWorkEnvelope, MachineWorkEnvelopeProps } from "./machine-work-envelope";
import { MachineSetupTimeProfile } from "./machine-setup-time-profile";
import { CalculationIssue } from "../entities/types";
import { MachineLimitError } from "../errors/machine-limit-error";
import { MachineEnvelopeExceededError } from "../errors/machine-envelope-exceeded-error";
import { MachineCapabilityMissingError } from "../errors/machine-capability-missing-error";

export interface MachineProfileProps {
  id: string;
  tenantId: string;
  siteId?: string;
  externalReferences: readonly ExternalReferenceSummary[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  machineCategory?: MachineCategory;
  controlSystem?: string;
  /** = `CapacityGroup.id`, existující entita (Krok 5) - logické pracoviště
   *  smí sdílet víc fyzických strojů. */
  logicalWorkstationId?: string;
  /** = `Machine.id`, existující entita - profil VŽDY patří JEDNOMU
   *  fyzickému stroji, i když sdílí `logicalWorkstationId` s dalšími. */
  physicalMachineId: string;
  maxRpm?: number;
  minRpm?: number;
  maxPowerKw?: number;
  maxTorqueNm?: number;
  workEnvelope?: MachineWorkEnvelope;
  maxPartDimensions?: MachineWorkEnvelope;
  maxPartWeightKg?: number;
  axisCount?: number;
  toolMagazineCapacity?: number;
  toolChangeTimeSec?: number;
  rapidTraverseRateMmMin?: number;
  accelerationMmSec2?: number;
  positioningAccuracyMm?: number;
  /** Maximální posuv (mm/min), pokud ho stroj má (AP-MCE-001 Fáze D §5/§8
   *  "Posuv omez: maximálním posuvem stroje, pokud je dostupný") - ADITIVNÍ
   *  pole nad Fázi B (`undefined` pro všechny profily založené před Fází D). */
  maxFeedRateMmMin?: number;
  availableFunctions: readonly MachineCapabilitySummary[];
  /** Layer 2 koeficienty (AP-MCE-001 Fáze A §03) - `performanceCoefficient`
   *  se NEUKLÁDÁ, počítá se z těchhle tří (viz getter níže), aby nikdy
   *  nemohly být vzájemně nekonzistentní. */
  powerCoefficient: number;
  ageCoefficient: number;
  conditionCoefficient: number;
  typicalSetupTimes: readonly MachineSetupTimeProfile[];
  tenantCorrectionId?: string;
  calibrationProfileId?: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/**
 * Kalkulační read-model stroje (AP-MCE-001 Fáze B §3) - na rozdíl od
 * `MaterialProfile` má VLASTNÍ `id` odlišné od `physicalMachineId`
 * (existujícího `Machine.id`), přesně podle zadání ("rozlišit logické
 * pracoviště a fyzický stroj", "použít dvě nebo více stejných strojních
 * jednotek" - dvě `MachineProfile` mohou sdílet `logicalWorkstationId`, ale
 * každá patří jinému `physicalMachineId`).
 */
export class MachineProfile {
  private readonly props: Readonly<MachineProfileProps>;

  private constructor(props: MachineProfileProps) {
    this.props = Object.freeze({
      ...props,
      externalReferences: Object.freeze([...props.externalReferences]),
      availableFunctions: Object.freeze([...props.availableFunctions]),
      typicalSetupTimes: Object.freeze([...props.typicalSetupTimes]),
    });
  }

  static create(props: MachineProfileProps): MachineProfile {
    if (!props.id.trim()) throw new ValidationError("MachineProfile: 'id' nesmí být prázdné.");
    if (!props.tenantId.trim()) throw new ValidationError("MachineProfile: 'tenantId' nesmí být prázdné.");
    if (!props.physicalMachineId.trim()) throw new ValidationError("MachineProfile: 'physicalMachineId' nesmí být prázdné.");
    if (props.minRpm !== undefined && props.maxRpm !== undefined && props.minRpm > props.maxRpm) {
      throw new ValidationError("MachineProfile: 'minRpm' nesmí být větší než 'maxRpm'.");
    }
    for (const [name, value] of Object.entries({
      powerCoefficient: props.powerCoefficient,
      ageCoefficient: props.ageCoefficient,
      conditionCoefficient: props.conditionCoefficient,
    })) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new ValidationError(`MachineProfile: '${name}' musí být kladné číslo, dostal jsem "${value}".`);
      }
    }
    if (!Number.isInteger(props.recordVersion) || props.recordVersion < 1) {
      throw new ValidationError("MachineProfile: 'recordVersion' musí být kladné celé číslo.");
    }
    return new MachineProfile(props);
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
  get model(): string | undefined {
    return this.props.model;
  }
  get serialNumber(): string | undefined {
    return this.props.serialNumber;
  }
  get machineCategory(): MachineCategory | undefined {
    return this.props.machineCategory;
  }
  get controlSystem(): string | undefined {
    return this.props.controlSystem;
  }
  get logicalWorkstationId(): string | undefined {
    return this.props.logicalWorkstationId;
  }
  get physicalMachineId(): string {
    return this.props.physicalMachineId;
  }
  get maxRpm(): number | undefined {
    return this.props.maxRpm;
  }
  get minRpm(): number | undefined {
    return this.props.minRpm;
  }
  get maxPowerKw(): number | undefined {
    return this.props.maxPowerKw;
  }
  get maxTorqueNm(): number | undefined {
    return this.props.maxTorqueNm;
  }
  get workEnvelope(): MachineWorkEnvelope | undefined {
    return this.props.workEnvelope;
  }
  get maxPartDimensions(): MachineWorkEnvelope | undefined {
    return this.props.maxPartDimensions;
  }
  get maxPartWeightKg(): number | undefined {
    return this.props.maxPartWeightKg;
  }
  get axisCount(): number | undefined {
    return this.props.axisCount;
  }
  get toolMagazineCapacity(): number | undefined {
    return this.props.toolMagazineCapacity;
  }
  get toolChangeTimeSec(): number | undefined {
    return this.props.toolChangeTimeSec;
  }
  get rapidTraverseRateMmMin(): number | undefined {
    return this.props.rapidTraverseRateMmMin;
  }
  get accelerationMmSec2(): number | undefined {
    return this.props.accelerationMmSec2;
  }
  get positioningAccuracyMm(): number | undefined {
    return this.props.positioningAccuracyMm;
  }
  get maxFeedRateMmMin(): number | undefined {
    return this.props.maxFeedRateMmMin;
  }
  get availableFunctions(): readonly MachineCapabilitySummary[] {
    return this.props.availableFunctions;
  }
  get powerCoefficient(): number {
    return this.props.powerCoefficient;
  }
  get ageCoefficient(): number {
    return this.props.ageCoefficient;
  }
  get conditionCoefficient(): number {
    return this.props.conditionCoefficient;
  }
  /** = `machineCoefficient` z AP-MCE-001 Fáze A §03 Layer 2 - odvozeno, ne
   *  uloženo, aby nikdy nemohlo být nekonzistentní se svými třemi vstupy. */
  get performanceCoefficient(): number {
    return this.props.powerCoefficient * this.props.ageCoefficient * this.props.conditionCoefficient;
  }
  get typicalSetupTimes(): readonly MachineSetupTimeProfile[] {
    return this.props.typicalSetupTimes;
  }
  get tenantCorrectionId(): string | undefined {
    return this.props.tenantCorrectionId;
  }
  get calibrationProfileId(): string | undefined {
    return this.props.calibrationProfileId;
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
        MachineProfileProps,
        | "powerCoefficient"
        | "ageCoefficient"
        | "conditionCoefficient"
        | "typicalSetupTimes"
        | "workEnvelope"
        | "maxPartDimensions"
        | "maxPartWeightKg"
        | "tenantCorrectionId"
        | "calibrationProfileId"
      >
    >,
    updatedAt: string
  ): MachineProfile {
    return MachineProfile.create({ ...this.props, ...changes, updatedAt, recordVersion: this.props.recordVersion + 1 });
  }

  archive(archivedAt: string): MachineProfile {
    if (this.props.archivedAt) return this;
    return new MachineProfile({ ...this.props, archivedAt, updatedAt: archivedAt, recordVersion: this.props.recordVersion + 1 });
  }

  hasFunction(capabilityTypeCode: string): boolean {
    return this.props.availableFunctions.some((f) => f.capabilityTypeCode === capabilityTypeCode);
  }

  /** Přísná varianta `hasFunction` - VYHODÍ `MachineCapabilityMissingError`
   *  místo tichého `false`/nezávazného `CalculationIssue`, jak to dělá
   *  `assertWithinLimits` (tam je chybějící funkce jen `warning` - AP-MCE-001
   *  §18). Použití: `CompareMachineProfilesUseCase` při explicitním filtru
   *  "jen stroje se schopností X", kde chybějící schopnost MÁ být blokující. */
  requireFunction(capabilityTypeCode: string): void {
    if (!this.hasFunction(capabilityTypeCode)) {
      throw new MachineCapabilityMissingError(this.props.id, capabilityTypeCode);
    }
  }

  typicalSetupTimeFor(operationCategory: MachineSetupTimeProfile["operationCategory"]): MachineSetupTimeProfile | undefined {
    return this.props.typicalSetupTimes.find((s) => s.operationCategory === operationCategory);
  }

  /**
   * Ověří požadavky operace proti fyzickým limitům stroje (AP-MCE-001 Fáze B
   * §3 "Validace musí kontrolovat: maximální otáčky, výkon, pracovní prostor,
   * maximální hmotnost dílu, dostupnost požadované funkce"). Vyhazuje
   * `MachineLimitError` pro BLOKUJÍCÍ překročení (otáčky, pracovní prostor,
   * hmotnost - AP-MCE-001 §18 je řadí jako `error`), vrací `CalculationIssue`
   * s `severity: "warning"` pro překročení výkonu (§18: jen `warning`) a pro
   * chybějící nepovinnou funkci.
   */
  assertWithinLimits(requirements: {
    requestedRpm?: number;
    requestedPowerKw?: number;
    partDimensions?: MachineWorkEnvelopeProps;
    partWeightKg?: number;
    requiredFunctionCodes?: readonly string[];
  }): CalculationIssue[] {
    const issues: CalculationIssue[] = [];

    if (requirements.requestedRpm !== undefined && this.props.maxRpm !== undefined && requirements.requestedRpm > this.props.maxRpm) {
      throw MachineLimitError.exceedsMaxRpm(this.props.physicalMachineId, requirements.requestedRpm, this.props.maxRpm);
    }

    if (requirements.partDimensions && this.props.workEnvelope?.exceededBy(requirements.partDimensions)) {
      throw MachineEnvelopeExceededError.forProfile(this.props.physicalMachineId);
    }

    if (
      requirements.partWeightKg !== undefined &&
      this.props.maxPartWeightKg !== undefined &&
      requirements.partWeightKg > this.props.maxPartWeightKg
    ) {
      throw MachineLimitError.exceedsMaxPartWeight(this.props.physicalMachineId, requirements.partWeightKg, this.props.maxPartWeightKg);
    }

    if (
      requirements.requestedPowerKw !== undefined &&
      this.props.maxPowerKw !== undefined &&
      requirements.requestedPowerKw > this.props.maxPowerKw
    ) {
      issues.push({
        code: "MACHINE_POWER_EXCEEDED",
        severity: "warning",
        message: `Požadovaný výkon (${requirements.requestedPowerKw} kW) překračuje maximum stroje (${this.props.maxPowerKw} kW).`,
      });
    }

    for (const code of requirements.requiredFunctionCodes ?? []) {
      if (!this.hasFunction(code)) {
        issues.push({
          code: "MACHINE_CAPABILITY_MISSING",
          severity: "warning",
          message: `Stroj nemá potvrzenou funkci "${code}".`,
          field: code,
        });
      }
    }

    return issues;
  }

  toPlainObject(): Record<string, unknown> {
    return {
      id: this.props.id,
      tenantId: this.props.tenantId,
      siteId: this.props.siteId,
      externalReferences: this.props.externalReferences,
      manufacturer: this.props.manufacturer,
      model: this.props.model,
      serialNumber: this.props.serialNumber,
      machineCategory: this.props.machineCategory,
      controlSystem: this.props.controlSystem,
      logicalWorkstationId: this.props.logicalWorkstationId,
      physicalMachineId: this.props.physicalMachineId,
      maxRpm: this.props.maxRpm,
      minRpm: this.props.minRpm,
      maxPowerKw: this.props.maxPowerKw,
      maxTorqueNm: this.props.maxTorqueNm,
      workEnvelope: this.props.workEnvelope?.toJSON(),
      maxPartDimensions: this.props.maxPartDimensions?.toJSON(),
      maxPartWeightKg: this.props.maxPartWeightKg,
      axisCount: this.props.axisCount,
      toolMagazineCapacity: this.props.toolMagazineCapacity,
      toolChangeTimeSec: this.props.toolChangeTimeSec,
      rapidTraverseRateMmMin: this.props.rapidTraverseRateMmMin,
      accelerationMmSec2: this.props.accelerationMmSec2,
      positioningAccuracyMm: this.props.positioningAccuracyMm,
      maxFeedRateMmMin: this.props.maxFeedRateMmMin,
      availableFunctions: this.props.availableFunctions,
      powerCoefficient: this.props.powerCoefficient,
      ageCoefficient: this.props.ageCoefficient,
      conditionCoefficient: this.props.conditionCoefficient,
      performanceCoefficient: this.performanceCoefficient,
      typicalSetupTimes: this.props.typicalSetupTimes.map((s) => s.toJSON()),
      tenantCorrectionId: this.props.tenantCorrectionId,
      calibrationProfileId: this.props.calibrationProfileId,
      recordVersion: this.props.recordVersion,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      archivedAt: this.props.archivedAt,
    };
  }
}
