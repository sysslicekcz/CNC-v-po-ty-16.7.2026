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

import { MillingCalculationInput } from "./milling-calculation-input";
import { MillingFeature } from "./milling-feature";
import { calculateFeatureCutting } from "./milling-feature-cutting";
import { resolveMillingCoefficients } from "./milling-coefficients";
import { computeConfidence, ConfidenceSignals } from "./milling-confidence";
import { accountForToolChanges, ToolUsageSegment } from "./tool-change-accounting";
import { MillingPowerEstimator, MvpMillingPowerEstimator } from "./milling-power-estimator";
import {
  checkMachineMillingCapability,
  checkMachineAxisCount,
  checkRigidTappingAvailability,
  checkThreeDCapabilityAvailability,
  checkToolMillingCapability,
  checkToolMaterialCompatibility,
  checkToolFitsFeature,
  checkToolLongEnoughForDepth,
  checkWorkEnvelope,
  checkPowerAndTorque,
} from "./milling-limits";
import { millingIssue } from "./milling-issue-codes";
import { MillingFeatureBreakdown, MillingCalculationBreakdown } from "./milling-calculation-breakdown";
import { readMachineProfileView, readMaterialProfileView, readToolProfileView } from "./milling-context-views";

/** MVP systémové výchozí hodnoty, POUZE pokud žádný jiný zdroj (explicit,
 *  vyřešená `CuttingCondition`, `ToolProfile`) neposkytl hodnotu - stejná
 *  filozofie jako Fáze C. Zdokumentované, konzervativní hodnoty pro obecnou
 *  ocel a malou stopkovou frézu. */
const SYSTEM_DEFAULT_CUTTING_SPEED_MMIN = 100;
const SYSTEM_DEFAULT_FEED_PER_TOOTH_MM = 0.05;
const SYSTEM_DEFAULT_TOOL_DIAMETER_MM = 10;
const SYSTEM_DEFAULT_TEETH_COUNT = 2;

interface ResolvedParameterValue {
  value: number;
  source: string;
  usedSystemDefault: boolean;
}

/** Priorita §5 "explicit > vyřešená CuttingCondition > ToolProfile default >
 *  systémový default" - jedno místo pro `cuttingSpeedMMin`/`feedPerToothMm`/
 *  `toolDiameterMm`/`teethCount`, stejný důvod jako Fáze C `resolveParameterValue`. */
function resolveParameterValue(explicit: number | undefined, resolved: number | undefined, resolvedSource: string | undefined, systemDefault: number): ResolvedParameterValue {
  if (explicit !== undefined) return { value: explicit, source: "explicit", usedSystemDefault: false };
  if (resolved !== undefined) return { value: resolved, source: resolvedSource ?? "resolved", usedSystemDefault: false };
  return { value: systemDefault, source: "system_default", usedSystemDefault: true };
}

function featureFootprint(feature: MillingFeature): { lengthMm: number; widthMm: number; heightMm: number; minWidthMm?: number } {
  const g = feature.geometry;
  switch (feature.subtype) {
    case "face_milling":
      return { lengthMm: g.areaLengthMm ?? 0, widthMm: g.areaWidthMm ?? 0, heightMm: g.machiningDepthMm ?? 0 };
    case "pocket_milling":
      return { lengthMm: g.pocketLengthMm ?? 0, widthMm: g.pocketWidthMm ?? 0, heightMm: g.pocketDepthMm ?? 0, minWidthMm: Math.min(g.pocketLengthMm ?? Infinity, g.pocketWidthMm ?? Infinity) };
    case "slot_milling":
      return { lengthMm: g.slotLengthMm ?? 0, widthMm: g.slotWidthMm ?? 0, heightMm: g.machiningDepthMm ?? 0, minWidthMm: g.slotWidthMm };
    case "contour_milling":
      return { lengthMm: g.contourLengthMm ?? 0, widthMm: 0, heightMm: g.machiningDepthMm ?? 0 };
    default:
      return { lengthMm: g.pathLengthMm ?? g.contourLengthMm ?? 0, widthMm: g.areaWidthMm ?? 0, heightMm: g.machiningDepthMm ?? 0 };
  }
}

/**
 * `MillingCalculationStrategy` (AP-MCE-001 Fáze D) - druhá plnohodnotná
 * implementace `CalculationStrategy` (Fáze A rozhraní, beze změny) - stejná
 * strukturální kostra jako Fáze C `TurningCalculationStrategy` (viz její
 * rozsáhlý komentář pro plné zdůvodnění vzoru "validate() jen blokující
 * kontroly" / "dvojí konstrukce CalculationBreakdown" / "6 základních
 * koeficientů neutrální, skutečné hodnoty v `millingDetail`"). ČISTÁ - žádný
 * přístup k repozitáři/síti/hodinám.
 */
export class MillingCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "milling";
  readonly strategyVersion = "milling-1.0.0";

  constructor(private readonly powerEstimator: MillingPowerEstimator = new MvpMillingPowerEstimator()) {}

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const millingInput = input as MillingCalculationInput;
    const issues: CalculationIssue[] = [];

    if (!millingInput.features || millingInput.features.length === 0) {
      issues.push(millingIssue("INVALID_PATH_LENGTH", "Operace musí mít alespoň jeden MillingFeature."));
      return issues;
    }
    if (!Number.isInteger(millingInput.quantity) || millingInput.quantity <= 0) {
      issues.push(millingIssue("INVALID_FEED_RATE", `'quantity' musí být kladné celé číslo, dostal jsem "${millingInput.quantity}".`));
    }

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    if (machine) {
      issues.push(...checkMachineMillingCapability(machine.machineCategory));
    }

    for (const feature of millingInput.features) {
      issues.push(...this.validateFeatureGeometry(feature));

      const toolSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      const toolView = toolSnapshot ? readToolProfileView(toolSnapshot) : undefined;
      if (toolView) {
        issues.push(...checkToolMillingCapability(toolView));
        const footprint = featureFootprint(feature);
        issues.push(...checkToolFitsFeature(toolView, footprint.minWidthMm));
        issues.push(...checkToolLongEnoughForDepth(toolView, footprint.heightMm > 0 ? footprint.heightMm : undefined));
      }

      if (machine) {
        issues.push(...checkMachineAxisCount(machine, feature.subtype));
        issues.push(...checkRigidTappingAvailability(machine, feature.subtype));
        issues.push(...checkThreeDCapabilityAvailability(machine, feature.subtype));

        const explicitRpm = feature.cuttingConditionOverride?.spindleSpeedRpm;
        if (explicitRpm !== undefined && machine.maxRpm !== undefined && explicitRpm > machine.maxRpm) {
          issues.push(
            millingIssue("RPM_EXCEEDS_MACHINE_LIMIT", `Explicitně zadané otáčky (${explicitRpm} min⁻¹) featuru "${feature.id}" přesahují maximum stroje (${machine.maxRpm} min⁻¹).`)
          );
        }
        const explicitFeedRate = feature.cuttingConditionOverride?.feedRateMmMin;
        if (explicitFeedRate !== undefined && machine.maxFeedRateMmMin !== undefined && explicitFeedRate > machine.maxFeedRateMmMin) {
          issues.push(
            millingIssue(
              "FEED_EXCEEDS_MACHINE_LIMIT",
              `Explicitně zadaný posuv (${explicitFeedRate} mm/min) featuru "${feature.id}" přesahuje maximum stroje (${machine.maxFeedRateMmMin} mm/min).`
            )
          );
        }

        const footprint = featureFootprint(feature);
        issues.push(...checkWorkEnvelope(machine, footprint.lengthMm, footprint.widthMm, footprint.heightMm));
      }
    }

    return issues;
  }

  private validateFeatureGeometry(feature: MillingFeature): CalculationIssue[] {
    const issues: CalculationIssue[] = [];
    const g = feature.geometry;

    switch (feature.subtype) {
      case "face_milling":
        if (!g.areaLengthMm || g.areaLengthMm <= 0 || !g.areaWidthMm || g.areaWidthMm <= 0) {
          issues.push(millingIssue("INVALID_PATH_LENGTH", `Feature "${feature.id}": srovnání roviny vyžaduje kladné 'areaLengthMm'/'areaWidthMm'.`));
        }
        break;
      case "pocket_milling":
        if (!g.pocketLengthMm || g.pocketLengthMm <= 0 || !g.pocketWidthMm || g.pocketWidthMm <= 0 || !g.pocketDepthMm || g.pocketDepthMm <= 0) {
          issues.push(millingIssue("INVALID_POCKET_GEOMETRY", `Feature "${feature.id}": kapsa vyžaduje kladné 'pocketLengthMm'/'pocketWidthMm'/'pocketDepthMm'.`));
        }
        break;
      case "contour_milling":
        if (!g.contourLengthMm || g.contourLengthMm <= 0) {
          issues.push(millingIssue("INVALID_CONTOUR_LENGTH", `Feature "${feature.id}": kontura vyžaduje kladné 'contourLengthMm'.`, "contourLengthMm"));
        }
        break;
      case "slot_milling":
        if (!g.slotLengthMm || g.slotLengthMm <= 0 || !g.slotWidthMm || g.slotWidthMm <= 0) {
          issues.push(millingIssue("INVALID_SLOT_GEOMETRY", `Feature "${feature.id}": drážka vyžaduje kladné 'slotLengthMm'/'slotWidthMm'.`));
        }
        break;
      case "drilling":
      case "countersinking":
      case "reaming":
      case "threading":
        if (!g.machiningDepthMm || g.machiningDepthMm <= 0) {
          issues.push(millingIssue("INVALID_DRILL_DEPTH", `Feature "${feature.id}": hloubka otvoru musí být kladné číslo.`, "machiningDepthMm"));
        }
        if (g.holeCount !== undefined && g.holeCount <= 0) {
          issues.push(millingIssue("INVALID_HOLE_COUNT", `Feature "${feature.id}": 'holeCount' musí být kladné celé číslo.`, "holeCount"));
        }
        if (feature.subtype === "threading" && (!g.threadPitchMm || g.threadPitchMm <= 0)) {
          issues.push(millingIssue("INVALID_THREAD_PITCH", `Feature "${feature.id}": závit vyžaduje kladné 'threadPitchMm'.`, "threadPitchMm"));
        }
        break;
      case "two_d":
      case "two_and_half_d":
        if ((!g.pathLengthMm || g.pathLengthMm <= 0) && (!g.contourLengthMm || g.contourLengthMm <= 0)) {
          issues.push(millingIssue("INVALID_PATH_LENGTH", `Feature "${feature.id}": vyžaduje 'pathLengthMm' nebo 'contourLengthMm'.`));
        }
        break;
      case "three_d":
        if ((!g.pathLengthMm || g.pathLengthMm <= 0) && !((g.areaLengthMm ?? g.pocketLengthMm) && (g.areaWidthMm ?? g.pocketWidthMm))) {
          issues.push(millingIssue("INVALID_PATH_LENGTH", `Feature "${feature.id}": 3D obrábění vyžaduje 'pathLengthMm' nebo 'areaLengthMm'/'areaWidthMm'.`));
        }
        break;
      case "custom_path":
        if (!g.pathLengthMm || g.pathLengthMm <= 0) {
          issues.push(millingIssue("INVALID_PATH_LENGTH", `Feature "${feature.id}": custom_path vyžaduje kladné 'pathLengthMm'.`, "pathLengthMm"));
        }
        break;
    }

    const override = feature.cuttingConditionOverride;
    if (override?.cuttingSpeedMMin !== undefined && override.cuttingSpeedMMin <= 0) {
      issues.push(millingIssue("INVALID_CUTTING_SPEED", `Feature "${feature.id}": explicitní 'cuttingSpeedMMin' musí být kladné číslo.`, "cuttingSpeedMMin"));
    }
    if (override?.feedPerToothMm !== undefined && override.feedPerToothMm < 0) {
      issues.push(millingIssue("INVALID_FEED_PER_TOOTH", `Feature "${feature.id}": explicitní 'feedPerToothMm' nesmí být záporné.`, "feedPerToothMm"));
    }
    if (override?.feedRateMmMin !== undefined && override.feedRateMmMin < 0) {
      issues.push(millingIssue("INVALID_FEED_RATE", `Feature "${feature.id}": explicitní 'feedRateMmMin' nesmí být záporné.`, "feedRateMmMin"));
    }
    if (override?.toolDiameterMm !== undefined && override.toolDiameterMm <= 0) {
      issues.push(millingIssue("INVALID_TOOL_DIAMETER", `Feature "${feature.id}": explicitní 'toolDiameterMm' musí být kladné číslo.`, "toolDiameterMm"));
    }
    if (override?.teethCount !== undefined && override.teethCount <= 0) {
      issues.push(millingIssue("INVALID_TEETH_COUNT", `Feature "${feature.id}": explicitní 'teethCount' musí být kladné celé číslo.`, "teethCount"));
    }
    if (feature.pathStrategy?.stepOverMm !== undefined && feature.pathStrategy.stepOverMm <= 0) {
      issues.push(millingIssue("INVALID_STEP_OVER", `Feature "${feature.id}": 'stepOverMm' musí být kladné číslo.`, "stepOverMm"));
    }
    if (feature.pathStrategy?.stepDownMm !== undefined && feature.pathStrategy.stepDownMm <= 0) {
      issues.push(millingIssue("INVALID_STEP_DOWN", `Feature "${feature.id}": 'stepDownMm' musí být kladné číslo.`, "stepDownMm"));
    }
    if (feature.toolEngagement?.widthOfCutMm !== undefined && feature.toolEngagement.widthOfCutMm < 0) {
      issues.push(millingIssue("INVALID_WIDTH_OF_CUT", `Feature "${feature.id}": 'widthOfCutMm' nesmí být záporné.`, "widthOfCutMm"));
    }
    if (feature.toolEngagement?.depthOfCutMm !== undefined && feature.toolEngagement.depthOfCutMm < 0) {
      issues.push(millingIssue("INVALID_DEPTH_OF_CUT", `Feature "${feature.id}": 'depthOfCutMm' nesmí být záporné.`, "depthOfCutMm"));
    }

    return issues;
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const millingInput = input as MillingCalculationInput;
    const features = [...millingInput.features].sort((a, b) => a.sequence - b.sequence);

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    const material = context.materialProfileSnapshot ? readMaterialProfileView(context.materialProfileSnapshot) : undefined;
    const materialCoefficient = material?.materialCoefficient ?? 1;
    const machineCoefficient = machine?.performanceCoefficient ?? 1;

    const featureBreakdowns: MillingFeatureBreakdown[] = [];
    const toolSegments: ToolUsageSegment[] = [];
    const toolLifeByToolId = new Map<string, ToolLifeProfile>();
    const toolChangeTimeSecByToolId = new Map<string, number | undefined>();
    const warnings: CalculationIssue[] = [];

    let rawCuttingTimeMin = 0;
    let adjustedCuttingTimeMin = 0;
    let rapidMoveTimeTotalMin = 0;
    let plungeTimeTotalMin = 0;
    let auxiliaryTotalMin = 0;
    let variableMeasurementTimeMin = 0;
    let firstPieceInspectionExtraMin = 0;

    let usedSystemDefaultCuttingCondition = false;
    let missingConcreteTool = false;
    let toolLifeUnknownFlag = false;
    let rpmClampedFlag = false;
    let feedClampedFlag = false;
    let manualPassCountFlag = false;
    let powerModelUnknownFlag = false;
    let derivedPathFlag = false;
    let threeDApproximationFlag = false;
    let unsuitableToolFlag = false;

    let previousToolIdForContribution: string | undefined;

    for (const feature of features) {
      const toolSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      const toolView = toolSnapshot ? readToolProfileView(toolSnapshot) : undefined;
      if (feature.toolProfileId && !toolView) missingConcreteTool = true;
      if (!feature.toolProfileId) missingConcreteTool = true;

      const resolvedCondition = context.millingCuttingConditionsByFeatureId?.[feature.id];
      const override = feature.cuttingConditionOverride;

      const resolvedToolDiameter = resolveParameterValue(override?.toolDiameterMm, toolView?.diameterMm, "tool_profile", SYSTEM_DEFAULT_TOOL_DIAMETER_MM);
      const resolvedTeethCount = resolveParameterValue(override?.teethCount, toolView?.teethCount, "tool_profile", SYSTEM_DEFAULT_TEETH_COUNT);
      const resolvedCuttingSpeed = resolveParameterValue(
        override?.cuttingSpeedMMin,
        resolvedCondition?.cuttingSpeedMMin,
        resolvedCondition?.cuttingSpeedSource,
        SYSTEM_DEFAULT_CUTTING_SPEED_MMIN
      );
      const resolvedFeed = resolveParameterValue(override?.feedPerToothMm, resolvedCondition?.feedPerToothMm, resolvedCondition?.feedSource, SYSTEM_DEFAULT_FEED_PER_TOOTH_MM);
      if (resolvedCuttingSpeed.usedSystemDefault || resolvedFeed.usedSystemDefault) {
        usedSystemDefaultCuttingCondition = true;
      }

      const sourceOfEachResolvedParameter: Record<string, string> = {
        toolDiameter: resolvedToolDiameter.source,
        teethCount: resolvedTeethCount.source,
        cuttingSpeed: resolvedCuttingSpeed.source,
        feedPerTooth: resolvedFeed.source,
        spindleSpeed: override?.spindleSpeedRpm !== undefined ? "explicit" : "derived",
        feedRate: override?.feedRateMmMin !== undefined ? "explicit" : "derived",
      };

      const cuttingResult = calculateFeatureCutting({
        feature,
        toolDiameterMm: resolvedToolDiameter.value,
        teethCount: resolvedTeethCount.value,
        cuttingSpeedMMin: resolvedCuttingSpeed.value,
        feedPerToothMm: resolvedFeed.value,
        machineMinRpm: machine?.minRpm,
        machineMaxRpm: machine?.maxRpm,
        machineMaxFeedRateMmMin: machine?.maxFeedRateMmMin,
        machineRapidTraverseRateMmMin: machine?.rapidTraverseRateMmMin,
        toolMaxCuttingSpeedMMin: toolView?.maxCuttingSpeedMMin,
        toolMaxFeedPerToothMm: toolView?.maxFeedPerToothMm,
      });
      sourceOfEachResolvedParameter.passCount = cuttingResult.passCountManuallySpecified ? "explicit" : "auto";

      warnings.push(...cuttingResult.warnings);
      if (cuttingResult.clampedToMachineLimit) rpmClampedFlag = true;
      if (cuttingResult.feedClampedToMachineLimit) feedClampedFlag = true;
      if (cuttingResult.passCountManuallySpecified) manualPassCountFlag = true;
      if (cuttingResult.derivedPath) derivedPathFlag = true;
      if (feature.subtype === "three_d") threeDApproximationFlag = true;

      const featureToolId = feature.toolProfileId;
      if (toolView && featureToolId) {
        const materialMismatchIssues = checkToolMaterialCompatibility(toolView, material?.materialGroupId ?? "");
        warnings.push(...materialMismatchIssues);
        if (materialMismatchIssues.length > 0) unsuitableToolFlag = true;
        const toolLife = ToolLifeProfile.fromJSON(toolView.toolLife);
        toolLifeByToolId.set(featureToolId, toolLife);
        toolChangeTimeSecByToolId.set(featureToolId, toolView.toolChangeTimeSec);
        if (toolLife.isUnknown) toolLifeUnknownFlag = true;
      }

      const widthOfCutMm = feature.toolEngagement?.widthOfCutMm ?? resolvedToolDiameter.value * 0.5;
      const depthOfCutMm = feature.toolEngagement?.depthOfCutMm ?? (cuttingResult.stepDownMm > 0 ? cuttingResult.stepDownMm : 1);
      const powerEstimate = this.powerEstimator.estimate({
        widthOfCutMm,
        depthOfCutMm,
        feedRateMmMin: cuttingResult.feedRateMmMin,
        toolDiameterMm: resolvedToolDiameter.value,
        materialCoefficient,
      });
      if (machine) {
        const { issues: powerIssues } = checkPowerAndTorque(powerEstimate.requiredPowerKw, cuttingResult.spindleSpeedRpm, machine);
        warnings.push(...powerIssues);
      } else {
        powerModelUnknownFlag = true;
      }

      const toolWearFactor = toolView ? ToolWearCurve.fromJSON(toolView.wearFactorCurve).factorAt(millingInput.quantity) : 1;
      const radialEngagementRatio = feature.toolEngagement?.widthOfCutMm !== undefined && resolvedToolDiameter.value > 0 ? feature.toolEngagement.widthOfCutMm / resolvedToolDiameter.value : undefined;
      const coefficients = resolveMillingCoefficients({
        machineCoefficient,
        materialCoefficient,
        complexityCoefficient: millingInput.complexityCoefficient,
        operatorSkillCoefficient: millingInput.operatorSkillCoefficient,
        toolWearFactor,
        interruptedCut: feature.interruptedCut ?? false,
        machiningMode: feature.machiningMode,
        subtype: feature.subtype,
        radialEngagementRatio,
        adaptiveClearing: feature.adaptiveClearing ?? false,
      });

      const featureRawTimeMin = cuttingResult.rawCuttingTimeMin + cuttingResult.plungeTimeMin;
      const featureAdjustedTimeMin = featureRawTimeMin * coefficients.combinedCuttingTimeCoefficient;
      rawCuttingTimeMin += cuttingResult.rawCuttingTimeMin;
      adjustedCuttingTimeMin += featureAdjustedTimeMin;
      plungeTimeTotalMin += cuttingResult.plungeTimeMin;
      rapidMoveTimeTotalMin += cuttingResult.rapidMoveTimeMin;
      auxiliaryTotalMin += cuttingResult.dwellTimeMin + cuttingResult.auxiliaryContributionMin;

      let measurementContributionMin = 0;
      if (feature.measurementRequirement === "every_piece") {
        measurementContributionMin = millingInput.measurementTimePerPieceMin ?? 0;
        variableMeasurementTimeMin += measurementContributionMin;
      } else if (feature.measurementRequirement === "sampling") {
        measurementContributionMin = (millingInput.measurementTimePerPieceMin ?? 0) / 2;
        variableMeasurementTimeMin += measurementContributionMin;
      } else if (feature.measurementRequirement === "first_piece") {
        measurementContributionMin = millingInput.measurementTimePerPieceMin ?? 0;
        firstPieceInspectionExtraMin += measurementContributionMin;
      }

      let toolChangeContributionMin = 0;
      if (featureToolId !== undefined) {
        const changeTimeMin = (toolChangeTimeSecByToolId.get(featureToolId) ?? 0) / 60;
        if (previousToolIdForContribution === undefined || previousToolIdForContribution !== featureToolId) {
          toolChangeContributionMin = changeTimeMin;
        }
        previousToolIdForContribution = featureToolId;
      } else {
        previousToolIdForContribution = undefined;
      }

      toolSegments.push({
        toolProfileId: featureToolId,
        cuttingTimePerPieceMin: cuttingResult.rawCuttingTimeMin,
        manualPlannedToolChanges: feature.plannedToolChanges,
      });

      featureBreakdowns.push({
        featureId: feature.id,
        subtype: feature.subtype,
        machiningMode: feature.machiningMode,
        sourceGeometry: feature.geometry,
        toolDiameterMm: resolvedToolDiameter.value,
        teethCount: resolvedTeethCount.value,
        cuttingSpeedMMin: cuttingResult.cuttingSpeedMMin,
        spindleSpeedRpm: cuttingResult.spindleSpeedRpm,
        spindleSpeedSource: cuttingResult.spindleSpeedSource,
        feedPerToothMm: cuttingResult.feedPerToothMm,
        feedRateMmMin: cuttingResult.feedRateMmMin,
        feedSource: cuttingResult.feedSource,
        effectivePathLengthMm: cuttingResult.effectivePathLengthMm,
        pathStrategy: cuttingResult.pathStrategy,
        depthLayers: cuttingResult.depthLayers,
        widthPasses: cuttingResult.widthPasses,
        stepOverMm: cuttingResult.stepOverMm,
        stepDownMm: cuttingResult.stepDownMm,
        rawCuttingTimeMin: cuttingResult.rawCuttingTimeMin,
        adjustedCuttingTimeMin: featureAdjustedTimeMin,
        rapidMoveTimeMin: cuttingResult.rapidMoveTimeMin,
        plungeTimeMin: cuttingResult.plungeTimeMin,
        toolChangeContributionMin,
        measurementContributionMin,
        toolWearContributionMin: (toolWearFactor - 1) * featureRawTimeMin,
        coefficientBreakdown: coefficients.contributions,
        warnings: cuttingResult.warnings,
        sourceOfEachResolvedParameter,
        approximationType: cuttingResult.approximationType,
        approximationReason: cuttingResult.approximationReason,
      });
    }

    const toolChangeAccounting = accountForToolChanges({
      segments: toolSegments,
      quantity: millingInput.quantity,
      toolLifeByToolId,
      toolChangeTimeSecByToolId,
    });
    if (toolChangeAccounting.toolIdsWithUnknownLife.length > 0) toolLifeUnknownFlag = true;
    if (toolLifeUnknownFlag) {
      warnings.push(millingIssue("TOOL_LIFE_UNKNOWN", "Aspoň jeden použitý nástroj má neznámou životnost."));
    }
    if (usedSystemDefaultCuttingCondition) {
      warnings.push(millingIssue("CUTTING_CONDITION_DEFAULTED", "Aspoň pro jeden feature se použila systémová výchozí řezná podmínka."));
    }
    if (manualPassCountFlag) {
      warnings.push(millingIssue("MANUAL_PASS_COUNT_USED", "Aspoň jeden feature měl ručně zadaný počet průchodů."));
    }

    const confidenceSignals: ConfidenceSignals = {
      usedSystemDefaultCuttingCondition,
      missingConcreteTool,
      toolLifeUnknown: toolLifeUnknownFlag,
      derivedPathInsteadOfExplicit: derivedPathFlag,
      threeDApproximation: threeDApproximationFlag,
      rpmClampedToMachineLimit: rpmClampedFlag,
      feedClampedToMachineLimit: feedClampedFlag,
      unknownPowerModel: powerModelUnknownFlag,
      manualPassCountWithoutGeometryCheck: manualPassCountFlag,
      missingCalibrationData: context.calibrationProfileId === undefined,
      unsuitableTool: unsuitableToolFlag,
      manualOverrideUsed: toolChangeAccounting.manuallyOverridden,
    };
    const confidenceBreakdown = computeConfidence(confidenceSignals);
    const recommendations: CalculationIssue[] = [];
    if (confidenceBreakdown.finalScore < 0.6) {
      recommendations.push(millingIssue("LOW_CONFIDENCE_RESULT", `Výsledek má nízkou důvěryhodnost (${confidenceBreakdown.finalScore.toFixed(2)}) - doporučuje se ruční kontrola.`));
    }

    const setupTimeMin = millingInput.setupTimeMin ?? 0;
    const handlingTimeMin = millingInput.handlingTimePerPieceMin ?? 0;
    const firstPieceInspectionTimeMin = (millingInput.firstPieceInspectionTimeMin ?? 0) + firstPieceInspectionExtraMin;
    const finalInspectionTimeMin = millingInput.finalInspectionTimeMin ?? 0;
    const toolChangeTimeMin = toolChangeAccounting.totalToolChangeTimeMin;
    const complexityCoefficientReal = millingInput.complexityCoefficient ?? 1;
    const operatorSkillCoefficientReal = millingInput.operatorSkillCoefficient ?? 1;
    const plannedFixtureChanges = millingInput.fixtureChangeCount ?? 0;

    // Všech šest základních (Fáze A) koeficientů je tu ZÁMĚRNĚ neutrálních
    // (1) - stejný důvod jako Fáze C `TurningCalculationStrategy` (viz její
    // komentář u analogického místa - zabránění dvojímu započtení).
    const props = {
      rawUnitTime: Time.ofMinutes(adjustedCuttingTimeMin + rapidMoveTimeTotalMin),
      setupTime: Time.ofMinutes(setupTimeMin * complexityCoefficientReal),
      firstPieceInspectionTime: Time.ofMinutes(firstPieceInspectionTimeMin),
      finalInspectionTime: Time.ofMinutes(finalInspectionTimeMin),
      toolChangeTime: Time.ofMinutes(toolChangeAccounting.totalToolChanges > 0 ? toolChangeTimeMin / toolChangeAccounting.totalToolChanges : 0),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.ofMinutes(handlingTimeMin * operatorSkillCoefficientReal),
      inOperationInspectionTime: Time.ofMinutes(variableMeasurementTimeMin),
      measurementTime: Time.zero(),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.ofMinutes(auxiliaryTotalMin),
      waitingTime: Time.zero(),
      quantity: Quantity.ofPieces(millingInput.quantity),
      plannedToolChanges: toolChangeAccounting.totalToolChanges,
      plannedFixtureChanges,
      operatorSkillCoefficient: 1,
      machineCoefficient: 1,
      materialCoefficient: 1,
      complexityCoefficient: 1,
      toolWearCoefficient: 1,
      historicalCalibrationCoefficient: 1,
      percentageAllowance: millingInput.percentageAllowance ?? 0,
      fixedAllowance: Time.ofMinutes(millingInput.fixedAllowanceMin ?? 0),
    };

    // Sestaví se DVAKRÁT - stejný důvod jako Fáze C (jediný zdroj pravdy pro
    // odvozené součty jsou gettery `CalculationBreakdown`, ne druhý, ručně
    // psaný vzorec vedle nich).
    const computed = CalculationBreakdown.create(props);

    const millingDetail: MillingCalculationBreakdown = {
      setupTimeMin,
      firstPieceInspectionTimeMin,
      finalInspectionTimeMin,
      rawCuttingTimeMin,
      adjustedCuttingTimeMin,
      rapidMoveTimeMin: rapidMoveTimeTotalMin,
      plungeTimeMin: plungeTimeTotalMin,
      handlingTimeMin,
      measurementTimeMin: variableMeasurementTimeMin,
      toolChangeTimeMin,
      fixtureChangeTimeMin: 0,
      auxiliaryTimeMin: auxiliaryTotalMin,
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
      toolChangeAccounting,
      strategyVersion: this.strategyVersion,
      algorithmVersion: "mce-v1",
    };

    return CalculationBreakdown.create({ ...props, millingDetail });
  }
}
