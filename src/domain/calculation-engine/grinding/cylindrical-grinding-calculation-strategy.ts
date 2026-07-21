import type { OperationCategory } from "../enums/operation-category";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";
import { CalculationStrategy } from "../services/calculation-strategy";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";
import { ToolLifeProfile } from "../profiles/tool-life-profile";
import { ToolWearCurve } from "../profiles/tool-wear-curve";

import { GrindingCalculationInput } from "./grinding-calculation-input";
import { GrindingFeature } from "./grinding-feature";
import { calculateCylindricalFeatureTime, resolveWorkpieceSpeed } from "./cylindrical-time";
import { resolveGrindingCoefficients } from "./grinding-coefficients";
import { computeConfidence, ConfidenceSignals } from "./grinding-confidence";
import { accountForWheelReplacements, WheelUsageSegment } from "./wheel-change-accounting";
import { resolveWheelDressing } from "./wheel-dressing-strategy";
import { resolveMeasurementStrategy } from "./measurement-strategy";
import { GrindingPowerEstimator, MvpGrindingPowerEstimator } from "./grinding-power-estimator";
import {
  checkMachineGrindingCapability,
  checkCylindricalGrindingCapability,
  checkInternalGrindingCapability,
  checkCenterlessGrindingCapability,
  checkWheelGrindingCapability,
  checkWheelMaterialCompatibility,
  checkWheelSpeedLimit,
  checkWorkEnvelope,
  checkPrecisionCapability,
  checkPower,
} from "./grinding-limits";
import { grindingIssue } from "./grinding-issue-codes";
import { GrindingFeatureBreakdown, GrindingCalculationBreakdown } from "./grinding-calculation-breakdown";
import { readMachineProfileView, readMaterialProfileView, readToolProfileView } from "./grinding-context-views";

/** MVP systémové výchozí hodnoty - zdokumentované, konzervativní hodnoty pro
 *  obecné broušení oceli, stejná filozofie jako Fáze C/D. */
const SYSTEM_DEFAULT_WORKPIECE_SPEED_RPM = 150;
const SYSTEM_DEFAULT_WHEEL_SPEED_MPS = 30;
const SYSTEM_DEFAULT_TABLE_SPEED_MM_MIN = 6000;
const SYSTEM_DEFAULT_PLUNGE_FEED_MM_MIN = 0.3;
const DEFAULT_RAPID_TRAVERSE_MM_MIN = 8000;

const PLUNGE_LIKE_SUBTYPES = new Set(["plunge_grinding", "face_grinding", "centerless_in_feed"]);

interface ResolvedParameterValue {
  value: number;
  source: string;
  usedSystemDefault: boolean;
}

/** Priorita "explicit > vyřešená CuttingCondition > systémový default" -
 *  stejný vzor jako Fáze C/D `resolveParameterValue`. */
function resolveParameterValue(explicit: number | undefined, resolved: number | undefined, resolvedSource: string | undefined, systemDefault: number): ResolvedParameterValue {
  if (explicit !== undefined) return { value: explicit, source: "explicit", usedSystemDefault: false };
  if (resolved !== undefined) return { value: resolved, source: resolvedSource ?? "resolved", usedSystemDefault: false };
  return { value: systemDefault, source: "system_default", usedSystemDefault: true };
}

/**
 * `CylindricalGrindingCalculationStrategy` (AP-MCE-001 Fáze E) - třetí
 * plnohodnotná implementace `CalculationStrategy` (po Fázi C/D), stejná
 * strukturální kostra jako `TurningCalculationStrategy`/`MillingCalculation
 * Strategy` (viz jejich komentáře pro plné zdůvodnění vzoru - "validate()
 * jen blokující kontroly" / "dvojí konstrukce CalculationBreakdown" / "6
 * základních koeficientů neutrální"). Pokrývá VÁLCOVOU rodinu podtypů
 * (`external_cylindrical`/`internal_cylindrical`/`face_grinding`/
 * `plunge_grinding`/`traverse_grinding`/`centerless_through_feed`/
 * `centerless_in_feed`) - rovinné broušení řeší sesterská
 * `SurfaceGrindingCalculationStrategy`. Do registru se NEREGISTRUJE PŘÍMO
 * (jedna `OperationCategory "grinding"` = jeden slot v `Map` uvnitř
 * `CalculationStrategyRegistry`), o výběr mezi touhle a `SurfaceGrinding
 * CalculationStrategy` se stará `GrindingCalculationStrategy` dispatcher
 * (jediný, co se skutečně registruje - viz jeho komentář pro celé
 * zdůvodnění, PROČ dvě strategie nejdou zaregistrovat zvlášť beze změny
 * `CalculationStrategyRegistry`, což by bylo "vytvoření nové architektury").
 */
export class CylindricalGrindingCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "grinding";
  readonly strategyVersion = "cylindrical-grinding-1.0.0";

  constructor(private readonly powerEstimator: GrindingPowerEstimator = new MvpGrindingPowerEstimator()) {}

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const grindingInput = input as GrindingCalculationInput;
    const issues: CalculationIssue[] = [];

    if (!grindingInput.features || grindingInput.features.length === 0) {
      issues.push(grindingIssue("INVALID_GRINDING_SUBTYPE", "Operace musí mít alespoň jeden GrindingFeature."));
      return issues;
    }
    if (!Number.isInteger(grindingInput.quantity) || grindingInput.quantity <= 0) {
      issues.push(grindingIssue("INVALID_PASS_COUNT", `'quantity' musí být kladné celé číslo, dostal jsem "${grindingInput.quantity}".`));
    }

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    if (machine) {
      issues.push(...checkMachineGrindingCapability(machine.machineCategory));
      issues.push(...checkCylindricalGrindingCapability(machine));
    }

    for (const feature of grindingInput.features) {
      issues.push(...this.validateFeatureGeometry(feature));

      if (machine && feature.subtype === "internal_cylindrical") {
        issues.push(...checkInternalGrindingCapability(machine));
      }
      if (machine && (feature.subtype === "centerless_through_feed" || feature.subtype === "centerless_in_feed")) {
        issues.push(...checkCenterlessGrindingCapability(machine));
      }

      const wheelSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      const wheelView = wheelSnapshot ? readToolProfileView(wheelSnapshot) : undefined;
      if (wheelView) {
        issues.push(...checkWheelGrindingCapability(wheelView));
        const wheelSpeedMps = feature.cuttingConditionOverride?.wheelSpeedMps;
        if (wheelSpeedMps !== undefined) issues.push(...checkWheelSpeedLimit(wheelSpeedMps, wheelView));
      }

      if (machine) {
        const explicitRpm = feature.cuttingConditionOverride?.workpieceSpeedRpm;
        if (explicitRpm !== undefined && machine.maxRpm !== undefined && explicitRpm > machine.maxRpm) {
          issues.push(grindingIssue("INVALID_WORKPIECE_SPEED", `Explicitně zadané otáčky obrobku (${explicitRpm} min⁻¹) featuru "${feature.id}" přesahují maximum stroje (${machine.maxRpm} min⁻¹).`));
        }

        const maxDiameterMm = Math.max(feature.geometry.startDiameterMm ?? 0, feature.geometry.endDiameterMm ?? 0);
        issues.push(...checkWorkEnvelope(machine, maxDiameterMm, feature.geometry.grindingLengthMm ?? 0));
        issues.push(...checkPrecisionCapability(machine, feature.machiningMode === "finishing" ? 0.005 : undefined));
      }
    }

    return issues;
  }

  private validateFeatureGeometry(feature: GrindingFeature): CalculationIssue[] {
    const issues: CalculationIssue[] = [];
    const g = feature.geometry;

    if (feature.subtype !== "face_grinding" && feature.subtype !== "custom_path") {
      if (g.startDiameterMm === undefined || g.startDiameterMm <= 0) {
        issues.push(grindingIssue("INVALID_START_DIAMETER", `Feature "${feature.id}": 'startDiameterMm' musí být kladné číslo.`, "startDiameterMm"));
      }
      if (g.endDiameterMm === undefined || g.endDiameterMm <= 0) {
        issues.push(grindingIssue("INVALID_END_DIAMETER", `Feature "${feature.id}": 'endDiameterMm' musí být kladné číslo.`, "endDiameterMm"));
      }
    }
    if (feature.subtype === "external_cylindrical" || feature.subtype === "internal_cylindrical" || feature.subtype === "traverse_grinding") {
      if (g.grindingLengthMm === undefined || g.grindingLengthMm <= 0) {
        issues.push(grindingIssue("INVALID_GRINDING_LENGTH", `Feature "${feature.id}": 'grindingLengthMm' musí být kladné číslo.`, "grindingLengthMm"));
      }
    }
    if (!Number.isFinite(g.stockAllowanceMm) || g.stockAllowanceMm < 0) {
      issues.push(grindingIssue("INVALID_STOCK_ALLOWANCE", `Feature "${feature.id}": 'stockAllowanceMm' nesmí být záporné.`, "stockAllowanceMm"));
    }

    const override = feature.cuttingConditionOverride;
    if (override?.wheelSpeedMps !== undefined && override.wheelSpeedMps <= 0) {
      issues.push(grindingIssue("INVALID_WHEEL_SPEED", `Feature "${feature.id}": explicitní 'wheelSpeedMps' musí být kladné číslo.`, "wheelSpeedMps"));
    }
    if (override?.workpieceSpeedRpm !== undefined && override.workpieceSpeedRpm <= 0) {
      issues.push(grindingIssue("INVALID_WORKPIECE_SPEED", `Feature "${feature.id}": explicitní 'workpieceSpeedRpm' musí být kladné číslo.`, "workpieceSpeedRpm"));
    }
    if (override?.tableSpeedMmMin !== undefined && override.tableSpeedMmMin <= 0) {
      issues.push(grindingIssue("INVALID_TABLE_SPEED", `Feature "${feature.id}": explicitní 'tableSpeedMmMin' musí být kladné číslo.`, "tableSpeedMmMin"));
    }
    if (override?.wheelDiameterMm !== undefined && override.wheelDiameterMm <= 0) {
      issues.push(grindingIssue("INVALID_WHEEL_DIAMETER", `Feature "${feature.id}": explicitní 'wheelDiameterMm' musí být kladné číslo.`, "wheelDiameterMm"));
    }
    if (override?.wheelWidthMm !== undefined && override.wheelWidthMm <= 0) {
      issues.push(grindingIssue("INVALID_WHEEL_WIDTH", `Feature "${feature.id}": explicitní 'wheelWidthMm' musí být kladné číslo.`, "wheelWidthMm"));
    }
    if (feature.passStrategy?.passCount !== undefined && feature.passStrategy.passCount <= 0) {
      issues.push(grindingIssue("INVALID_PASS_COUNT", `Feature "${feature.id}": 'passCount' musí být kladné celé číslo.`, "passCount"));
    }
    if (feature.passStrategy?.sparkOutPasses !== undefined && feature.passStrategy.sparkOutPasses < 0) {
      issues.push(grindingIssue("INVALID_SPARK_OUT_COUNT", `Feature "${feature.id}": 'sparkOutPasses' nesmí být záporné.`, "sparkOutPasses"));
    }
    if (feature.dressingStrategy?.dressingIntervalPieces !== undefined && feature.dressingStrategy.dressingIntervalPieces <= 0) {
      issues.push(grindingIssue("INVALID_DRESSING_INTERVAL", `Feature "${feature.id}": 'dressingIntervalPieces' musí být kladné číslo.`, "dressingIntervalPieces"));
    }
    if (feature.measurementFrequencyPieces !== undefined && feature.measurementFrequencyPieces <= 0) {
      issues.push(grindingIssue("INVALID_MEASUREMENT_FREQUENCY", `Feature "${feature.id}": 'measurementFrequencyPieces' musí být kladné číslo.`, "measurementFrequencyPieces"));
    }

    return issues;
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const grindingInput = input as GrindingCalculationInput;
    const features = [...grindingInput.features].sort((a, b) => a.sequence - b.sequence);

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    const material = context.materialProfileSnapshot ? readMaterialProfileView(context.materialProfileSnapshot) : undefined;
    const materialCoefficient = material?.materialCoefficient ?? 1;
    const machineCoefficient = machine?.performanceCoefficient ?? 1;

    const featureBreakdowns: GrindingFeatureBreakdown[] = [];
    const wheelSegments: WheelUsageSegment[] = [];
    const wheelLifeByWheelId = new Map<string, ToolLifeProfile>();
    const wheelChangeTimeSecByWheelId = new Map<string, number | undefined>();
    const warnings: CalculationIssue[] = [];

    let rawGrindingTimeMin = 0;
    let adjustedGrindingTimeMin = 0;
    let sparkOutTimeMin = 0;
    let auxiliaryTotalMin = 0;
    let variableMeasurementTimeMin = 0;
    let firstPieceInspectionExtraMin = 0;
    let correctionPassTotalMin = 0;

    let usedSystemDefaultCuttingCondition = false;
    let missingConcreteWheel = false;
    let wheelLifeUnknownFlag = false;
    let rpmClampedFlag = false;
    let manualPassCountFlag = false;
    let centerlessApproximationFlag = false;
    let unknownMeasurementFlag = false;
    let previousWheelIdForContribution: string | undefined;

    let firstDressingStrategyInput: GrindingFeature["dressingStrategy"];

    for (const feature of features) {
      if (firstDressingStrategyInput === undefined && feature.dressingStrategy !== undefined) {
        firstDressingStrategyInput = feature.dressingStrategy;
      }

      const wheelSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      const wheelView = wheelSnapshot ? readToolProfileView(wheelSnapshot) : undefined;
      if (!feature.wheelProfileId || !wheelView) missingConcreteWheel = true;

      const resolvedCondition = context.grindingCuttingConditionsByFeatureId?.[feature.id];
      const override = feature.cuttingConditionOverride;

      const resolvedWorkpieceSpeed = resolveWorkpieceSpeed({
        explicitWorkpieceSpeedRpm: override?.workpieceSpeedRpm,
        resolvedWorkpieceSpeedRpm: resolvedCondition?.workpieceSpeedRpm,
        systemDefaultWorkpieceSpeedRpm: SYSTEM_DEFAULT_WORKPIECE_SPEED_RPM,
        machineMinRpm: machine?.minRpm,
        machineMaxRpm: machine?.maxRpm,
      });
      if (resolvedWorkpieceSpeed.clampedToMachineLimit) rpmClampedFlag = true;
      warnings.push(...resolvedWorkpieceSpeed.warnings);

      const resolvedWheelSpeed = resolveParameterValue(override?.wheelSpeedMps, resolvedCondition?.wheelSpeedMps, resolvedCondition?.wheelSpeedSource, SYSTEM_DEFAULT_WHEEL_SPEED_MPS);
      const isPlungeLike = PLUNGE_LIKE_SUBTYPES.has(feature.subtype);
      const resolvedFeedRate = resolveParameterValue(
        isPlungeLike ? override?.feedRateMmMin : override?.tableSpeedMmMin,
        resolvedCondition?.tableSpeedMmMin,
        resolvedCondition?.tableSpeedSource,
        isPlungeLike ? SYSTEM_DEFAULT_PLUNGE_FEED_MM_MIN : SYSTEM_DEFAULT_TABLE_SPEED_MM_MIN
      );
      if (resolvedWheelSpeed.usedSystemDefault || resolvedFeedRate.usedSystemDefault) usedSystemDefaultCuttingCondition = true;

      const sourceOfEachResolvedParameter: Record<string, string> = {
        workpieceSpeed: resolvedWorkpieceSpeed.source,
        wheelSpeed: resolvedWheelSpeed.source,
        [isPlungeLike ? "plungeFeed" : "tableSpeed"]: resolvedFeedRate.source,
      };

      const cuttingResult = calculateCylindricalFeatureTime({
        feature,
        workpieceSpeedRpm: resolvedWorkpieceSpeed.rpm,
        wheelSpeedMps: resolvedWheelSpeed.value,
        tableSpeedMmMin: isPlungeLike ? SYSTEM_DEFAULT_TABLE_SPEED_MM_MIN : resolvedFeedRate.value,
        plungeFeedMmMin: isPlungeLike ? resolvedFeedRate.value : SYSTEM_DEFAULT_PLUNGE_FEED_MM_MIN,
        rapidTraverseRateMmMin: machine?.rapidTraverseRateMmMin ?? DEFAULT_RAPID_TRAVERSE_MM_MIN,
      });
      sourceOfEachResolvedParameter.passCount = cuttingResult.passCountManuallySpecified ? "explicit" : "auto";

      warnings.push(...cuttingResult.warnings);
      if (cuttingResult.passCountManuallySpecified) manualPassCountFlag = true;
      if (cuttingResult.approximationType === "centerless") centerlessApproximationFlag = true;

      const wheelId = feature.wheelProfileId;
      if (wheelView && wheelId) {
        const materialMismatchIssues = checkWheelMaterialCompatibility(wheelView, material?.materialGroupId ?? "");
        warnings.push(...materialMismatchIssues);
        const wheelLife = ToolLifeProfile.fromJSON(wheelView.toolLife);
        wheelLifeByWheelId.set(wheelId, wheelLife);
        wheelChangeTimeSecByWheelId.set(wheelId, wheelView.toolChangeTimeSec);
        if (wheelLife.isUnknown) wheelLifeUnknownFlag = true;
      }

      const materialRemovalRateMm3PerMin = cuttingResult.rawGrindingTimeMin > 0 ? cuttingResult.removedVolumeMm3 / cuttingResult.rawGrindingTimeMin : 0;
      const powerEstimate = this.powerEstimator.estimate({ materialRemovalRateMm3PerMin, materialCoefficient });
      if (machine) {
        const { issues: powerIssues } = checkPower(powerEstimate.requiredPowerKw, machine);
        warnings.push(...powerIssues);
      }

      const wheelWearFactor = wheelView ? ToolWearCurve.fromJSON(wheelView.wearFactorCurve).factorAt(grindingInput.quantity) : 1;
      const coefficients = resolveGrindingCoefficients({
        machineCoefficient,
        materialCoefficient,
        complexityCoefficient: grindingInput.complexityCoefficient,
        operatorSkillCoefficient: grindingInput.operatorSkillCoefficient,
        wheelWearFactor,
        machiningMode: feature.machiningMode,
        subtype: feature.subtype,
        machinePositioningAccuracyKnown: machine?.positioningAccuracyMm !== undefined,
        usedDefaultDressingInterval: feature.dressingStrategy?.dressingIntervalPieces === undefined && feature.dressingStrategy?.dressingIntervalMinutes === undefined,
        coolantEnabled: grindingInput.coolantMode !== undefined,
      });

      const featureAdjustedTimeMin = cuttingResult.rawGrindingTimeMin * coefficients.combinedGrindingTimeCoefficient;
      rawGrindingTimeMin += cuttingResult.rawGrindingTimeMin;
      adjustedGrindingTimeMin += featureAdjustedTimeMin;

      const measurement = resolveMeasurementStrategy({
        measurementRequirement: feature.measurementRequirement ?? "none",
        measurementFrequencyPieces: feature.measurementFrequencyPieces,
        measurementTimeMin: feature.measurementTimeMin ?? grindingInput.measurementTimePerPieceMin,
        correctionPassOnDeviation: feature.correctionPassOnDeviation,
        correctionPassTimeMin: feature.correctionPassTimeMin,
      });
      variableMeasurementTimeMin += measurement.variableMeasurementTimeMin;
      firstPieceInspectionExtraMin += measurement.firstPieceMeasurementTimeMin;
      correctionPassTotalMin += measurement.correctionPassContributionMin;
      if ((feature.measurementRequirement ?? "none") !== "none" && feature.measurementTimeMin === undefined && grindingInput.measurementTimePerPieceMin === undefined) {
        unknownMeasurementFlag = true;
      }

      let wheelChangeContributionMin = 0;
      if (wheelId !== undefined) {
        const changeTimeMin = (wheelChangeTimeSecByWheelId.get(wheelId) ?? 0) / 60;
        if (previousWheelIdForContribution === undefined || previousWheelIdForContribution !== wheelId) {
          wheelChangeContributionMin = changeTimeMin;
        }
        previousWheelIdForContribution = wheelId;
      } else {
        previousWheelIdForContribution = undefined;
      }

      wheelSegments.push({
        wheelProfileId: wheelId,
        grindingTimePerPieceMin: cuttingResult.rawGrindingTimeMin,
        removedVolumePerPieceMm3: cuttingResult.removedVolumeMm3,
        manualPlannedReplacements: feature.plannedWheelReplacements,
      });

      const sparkOutContributionMin = cuttingResult.sparkOutPasses > 0 && cuttingResult.totalPasses > 0 ? (cuttingResult.rawGrindingTimeMin / cuttingResult.totalPasses) * cuttingResult.sparkOutPasses : 0;
      sparkOutTimeMin += sparkOutContributionMin;
      auxiliaryTotalMin += (feature.geometry.dwellTimeSec ?? 0) / 60;

      featureBreakdowns.push({
        featureId: feature.id,
        subtype: feature.subtype,
        machiningMode: feature.machiningMode,
        sourceGeometry: feature.geometry,
        startDimension: feature.geometry.startDiameterMm,
        targetDimension: feature.geometry.endDiameterMm,
        stockAllowanceMm: feature.geometry.stockAllowanceMm,
        radialStockMm: cuttingResult.radialStockMm,
        axialStockMm: cuttingResult.axialStockMm,
        infeedPerPassMm: cuttingResult.infeedPerPassMm,
        roughingPasses: cuttingResult.roughingPasses,
        finishingPasses: cuttingResult.finishingPasses,
        sparkOutPasses: cuttingResult.sparkOutPasses,
        totalPasses: cuttingResult.totalPasses,
        effectiveStrokeLengthMm: cuttingResult.effectiveStrokeLengthMm,
        tableSpeedMmMin: isPlungeLike ? undefined : resolvedFeedRate.value,
        workpieceSpeedRpm: resolvedWorkpieceSpeed.rpm,
        wheelSpeedMps: resolvedWheelSpeed.value,
        totalStrokes: cuttingResult.totalStrokes,
        removedVolumeMm3: cuttingResult.removedVolumeMm3,
        rawGrindingTimeMin: cuttingResult.rawGrindingTimeMin,
        adjustedGrindingTimeMin: featureAdjustedTimeMin,
        dressingContributionMin: 0,
        measurementContributionMin: measurement.variableMeasurementTimeMin + measurement.firstPieceMeasurementTimeMin,
        sparkOutContributionMin,
        wheelReplacementContributionMin: wheelChangeContributionMin,
        coefficientBreakdown: coefficients.contributions,
        warnings: cuttingResult.warnings,
        sourceOfEachResolvedParameter,
        approximationType: cuttingResult.approximationType,
        approximationReason: cuttingResult.approximationReason,
      });
    }

    const wheelChangeAccounting = accountForWheelReplacements({
      segments: wheelSegments,
      quantity: grindingInput.quantity,
      wheelLifeByWheelId,
      wheelChangeTimeSecByWheelId,
    });
    if (wheelChangeAccounting.wheelIdsWithUnknownLife.length > 0) wheelLifeUnknownFlag = true;

    const dressing = resolveWheelDressing(firstDressingStrategyInput ?? {}, grindingInput.quantity, rawGrindingTimeMin);
    warnings.push(...dressing.warnings);

    if (wheelLifeUnknownFlag) warnings.push(grindingIssue("WHEEL_LIFE_UNKNOWN", "Aspoň jeden použitý kotouč má neznámou životnost."));
    if (usedSystemDefaultCuttingCondition) warnings.push(grindingIssue("CUTTING_CONDITION_DEFAULTED", "Aspoň pro jeden feature se použila systémová výchozí řezná podmínka."));
    if (manualPassCountFlag) warnings.push(grindingIssue("PASS_COUNT_MANUALLY_DEFINED", "Aspoň jeden feature měl ručně zadaný počet průchodů."));

    const confidenceSignals: ConfidenceSignals = {
      usedSystemDefaultCuttingCondition,
      missingConcreteWheel,
      wheelLifeUnknown: wheelLifeUnknownFlag,
      dressingIntervalDefaulted: dressing.usedDefaultInterval,
      centerlessApproximation: centerlessApproximationFlag,
      manualPassCountUsed: manualPassCountFlag,
      unknownMeasurement: unknownMeasurementFlag,
      unknownMachinePrecision: machine?.positioningAccuracyMm === undefined,
      rpmClampedToMachineLimit: rpmClampedFlag,
      manualOverrideUsed: wheelChangeAccounting.manuallyOverridden || dressing.manuallyOverridden,
      missingCalibrationData: context.calibrationProfileId === undefined,
    };
    const confidenceBreakdown = computeConfidence(confidenceSignals);
    const recommendations: CalculationIssue[] = [];
    if (confidenceBreakdown.finalScore < 0.6) {
      recommendations.push(grindingIssue("LOW_CONFIDENCE_RESULT", `Výsledek má nízkou důvěryhodnost (${confidenceBreakdown.finalScore.toFixed(2)}) - doporučuje se ruční kontrola.`));
    }

    const setupTimeMin = grindingInput.setupTimeMin ?? 0;
    const handlingTimeMin = grindingInput.handlingTimePerPieceMin ?? 0;
    const firstPieceInspectionTimeMin = (grindingInput.firstPieceInspectionTimeMin ?? 0) + firstPieceInspectionExtraMin;
    const finalInspectionTimeMin = grindingInput.finalInspectionTimeMin ?? 0;
    const complexityCoefficientReal = grindingInput.complexityCoefficient ?? 1;
    const operatorSkillCoefficientReal = grindingInput.operatorSkillCoefficient ?? 1;
    const plannedFixtureChanges = features.reduce((sum, f) => sum + (f.fixtureChangeCount ?? 0), 0);

    const props = {
      // §12 - `dressingTimeMin` je BATCH-FIXED náklad (orovnání proběhne
      // celkem `totalDressings`-krát za CELOU dávku, ne na kus), proto se
      // skládá do `setupTime` (jediné pole, které `CalculationBreakdown.
      // batchFixedTime` getter čte a NEnásobí ho počtem kusů) - `auxiliaryTime`
      // prop (Fáze A) NENÍ čtena ŽÁDNÝM getterem, jen `rawUnitTime`/
      // `setupTime`/`handlingTime`/`toolChangeTime`/`fixtureChangeTime` fakticky
      // ovlivňují `totalOperationTime` (viz jejich gettery) - dwell/rychlo-
      // posuv/čištění/obrácení dílu (`auxiliaryTotalMin`, PER PIECE) proto jdou
      // do `rawUnitTime`, ne do `auxiliaryTime`.
      rawUnitTime: Time.ofMinutes(adjustedGrindingTimeMin + correctionPassTotalMin + auxiliaryTotalMin),
      setupTime: Time.ofMinutes(setupTimeMin * complexityCoefficientReal + dressing.totalDressingTimeMin),
      firstPieceInspectionTime: Time.ofMinutes(firstPieceInspectionTimeMin),
      finalInspectionTime: Time.ofMinutes(finalInspectionTimeMin),
      toolChangeTime: Time.ofMinutes(wheelChangeAccounting.totalWheelReplacements > 0 ? wheelChangeAccounting.totalWheelReplacementTimeMin / wheelChangeAccounting.totalWheelReplacements : 0),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.ofMinutes(handlingTimeMin * operatorSkillCoefficientReal),
      inOperationInspectionTime: Time.ofMinutes(variableMeasurementTimeMin),
      measurementTime: Time.zero(),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.ofMinutes(auxiliaryTotalMin + dressing.totalDressingTimeMin), // informativní pole, viz komentář výš
      waitingTime: Time.zero(),
      quantity: Quantity.ofPieces(grindingInput.quantity),
      plannedToolChanges: wheelChangeAccounting.totalWheelReplacements,
      plannedFixtureChanges,
      operatorSkillCoefficient: 1,
      machineCoefficient: 1,
      materialCoefficient: 1,
      complexityCoefficient: 1,
      toolWearCoefficient: 1,
      historicalCalibrationCoefficient: 1,
      percentageAllowance: grindingInput.percentageAllowance ?? 0,
      fixedAllowance: Time.ofMinutes(grindingInput.fixedAllowanceMin ?? 0),
    };

    const computed = CalculationBreakdown.create(props);

    const grindingDetail: GrindingCalculationBreakdown = {
      setupTimeMin,
      firstPieceInspectionTimeMin,
      finalInspectionTimeMin,
      rawGrindingTimeMin,
      adjustedGrindingTimeMin,
      handlingTimeMin,
      measurementTimeMin: variableMeasurementTimeMin,
      dressingTimeMin: dressing.totalDressingTimeMin,
      wheelReplacementTimeMin: wheelChangeAccounting.totalWheelReplacementTimeMin,
      fixtureChangeTimeMin: 0,
      sparkOutTimeMin,
      auxiliaryTimeMin: auxiliaryTotalMin + dressing.totalDressingTimeMin,
      allowanceTimeMin: computed.totalOperationTime.minutes - computed.totalOperationTimeRaw.minutes,
      unitTimeMin: computed.unitTimeAdjusted.minutes,
      batchVariableTimeMin: computed.batchVariableTime.minutes,
      batchFixedTimeMin: computed.batchFixedTime.minutes,
      totalOperationTimeMin: computed.totalOperationTime.minutes,
      effectiveUnitTimeMin: computed.unitTimeAdjusted.minutes,
      confidenceScore: confidenceBreakdown.finalScore,
      confidenceBreakdown,
      warnings,
      recommendations,
      features: featureBreakdowns,
      wheelChangeAccounting,
      wheelDressingAccounting: {
        initialDressings: dressing.initialDressings,
        intervalDressings: dressing.intervalDressings,
        manualDressings: dressing.manualDressings,
        conditionTriggeredDressings: dressing.conditionTriggeredDressings,
        totalDressings: dressing.totalDressings,
      },
      strategyVersion: this.strategyVersion,
      algorithmVersion: "mce-v1",
    };

    return CalculationBreakdown.create({ ...props, grindingDetail });
  }
}
