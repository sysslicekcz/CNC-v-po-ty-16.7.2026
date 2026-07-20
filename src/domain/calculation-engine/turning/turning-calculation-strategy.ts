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

import { TurningCalculationInput } from "./turning-calculation-input";
import { TurningFeature } from "./turning-feature";
import { calculateFeatureCutting } from "./turning-feature-cutting";
import { resolveTurningCoefficients } from "./turning-coefficients";
import { computeConfidence, ConfidenceSignals } from "./turning-confidence";
import { accountForToolChanges, ToolUsageSegment } from "./tool-change-accounting";
import { TurningPowerEstimator, MvpTurningPowerEstimator } from "./turning-power-estimator";
import { checkMachineTurningCapability, checkToolTurningCapability, checkToolMaterialCompatibility, checkWorkEnvelope, checkPowerAndTorque } from "./turning-limits";
import { turningIssue } from "./turning-issue-codes";
import { TurningFeatureBreakdown, TurningCalculationBreakdown } from "./turning-calculation-breakdown";
import { readMachineProfileView, readMaterialProfileView, readToolProfileView, ToolProfileView } from "./turning-context-views";

/** MVP systémový výchozí odhad, POUZE pokud žádný jiný zdroj (explicit,
 *  vyřešená `CuttingCondition`, doporučení nástroje/materiálu) neposkytl
 *  hodnotu - stejná filozofie jako Fáze B `resolveCuttingConditions()`
 *  úroveň 6/7 ("systémový default, ne vyhozená výjimka"). Zdokumentované,
 *  konzervativní hodnoty pro obecnou ocel. */
const SYSTEM_DEFAULT_CUTTING_SPEED_MMIN = 100;
const SYSTEM_DEFAULT_FEED_PER_REV_MM = 0.2;

interface ResolvedParameterValue {
  value: number;
  source: string;
  usedSystemDefault: boolean;
}

/** Priorita §5/§6 "explicit > vyřešená CuttingCondition > systémový default" -
 *  jedno místo pro `cuttingSpeedMMin`/`feedPerRevolutionMm`, aby se stejná
 *  tříúrovňová logika nepsala dvakrát skoro stejně (a aby TypeScript uměl
 *  odvodit, že výsledek je vždy `number`, nikdy `number | undefined`). */
function resolveParameterValue(explicit: number | undefined, resolved: number | undefined, resolvedSource: string | undefined, systemDefault: number): ResolvedParameterValue {
  if (explicit !== undefined) return { value: explicit, source: "explicit", usedSystemDefault: false };
  if (resolved !== undefined) return { value: resolved, source: resolvedSource ?? "resolved", usedSystemDefault: false };
  return { value: systemDefault, source: "system_default", usedSystemDefault: true };
}

/**
 * `TurningCalculationStrategy` (AP-MCE-001 Fáze C) - první plnohodnotná
 * implementace `CalculationStrategy` (Fáze A rozhraní, beze změny). ČISTÁ -
 * žádný přístup k repozitáři/síti/hodinám (§20 architektonický test) - vše
 * potřebuje dostane přes `input`/`context`, které Application vrstva
 * (`CalculateTurningOperationUseCase`) připraví předem.
 *
 * `validate()` vrací JEN blokující kontroly, které lze provést BEZ skutečného
 * výpočtu (geometrie, explicitní hodnoty mimo limit, capability stroje/
 * nástroje, pracovní prostor) - `DefaultCalculationEngine` volá `calculate()`
 * pouze když tu nic blokujícího není. Nezávazné signály (RPM clamping,
 * překročení výkonu, defaultovaná řezná podmínka, nízká confidence, ...) se
 * dozví teprve PRŮBĚHEM výpočtu (potřebují znát otáčky/výkon apod.) - `Calcu
 * lationStrategy.calculate()` ale vrací jen `CalculationBreakdown`, ne
 * samostatný seznam issues (Fáze A rozhraní, neměnit). Proto se ukládají do
 * `breakdown.turningDetail.warnings`/`.recommendations` (přesně tvar, který
 * §9 breakdown pole žádá) - `CalculateTurningOperationUseCase` je odtud
 * přečte a sloučí do `CalculationResult.issues`.
 */
export class TurningCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "turning";
  readonly strategyVersion = "turning-1.0.0";

  constructor(private readonly powerEstimator: TurningPowerEstimator = new MvpTurningPowerEstimator()) {}

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const turningInput = input as TurningCalculationInput;
    const issues: CalculationIssue[] = [];

    if (!turningInput.features || turningInput.features.length === 0) {
      issues.push(turningIssue("INVALID_MACHINING_LENGTH", "Operace musí mít alespoň jeden TurningFeature."));
      return issues;
    }
    if (!Number.isInteger(turningInput.quantity) || turningInput.quantity <= 0) {
      issues.push(turningIssue("INVALID_PASS_COUNT", `'quantity' musí být kladné celé číslo, dostal jsem "${turningInput.quantity}".`));
    }

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    if (machine) {
      issues.push(...checkMachineTurningCapability(machine.machineCategory));
    }

    for (const feature of turningInput.features) {
      issues.push(...this.validateFeatureGeometry(feature));

      const toolSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      if (toolSnapshot) {
        issues.push(...checkToolTurningCapability(readToolProfileView(toolSnapshot)));
      }

      if (machine) {
        const explicitRpm = feature.cuttingConditionOverride?.spindleSpeedRpm;
        if (explicitRpm !== undefined && machine.maxRpm !== undefined && explicitRpm > machine.maxRpm) {
          issues.push(
            turningIssue(
              "RPM_EXCEEDS_MACHINE_LIMIT",
              `Explicitně zadané otáčky (${explicitRpm} min⁻¹) featuru "${feature.id}" přesahují maximum stroje (${machine.maxRpm} min⁻¹).`
            )
          );
        }

        const maxDiameterMm = Math.max(feature.geometry.startDiameterMm, feature.geometry.endDiameterMm);
        issues.push(...checkWorkEnvelope(machine, maxDiameterMm, feature.geometry.machiningLengthMm));
      }
    }

    return issues;
  }

  private validateFeatureGeometry(feature: TurningFeature): CalculationIssue[] {
    const issues: CalculationIssue[] = [];
    const g = feature.geometry;

    if (!Number.isFinite(g.startDiameterMm) || g.startDiameterMm <= 0) {
      issues.push(turningIssue("INVALID_START_DIAMETER", `Feature "${feature.id}": 'startDiameterMm' musí být kladné číslo.`, "startDiameterMm"));
    }
    if (!Number.isFinite(g.endDiameterMm) || g.endDiameterMm <= 0) {
      issues.push(turningIssue("INVALID_END_DIAMETER", `Feature "${feature.id}": 'endDiameterMm' musí být kladné číslo.`, "endDiameterMm"));
    }

    const invalidLength = !Number.isFinite(g.machiningLengthMm) || g.machiningLengthMm <= 0;
    if (invalidLength && feature.subtype === "drilling") {
      issues.push(turningIssue("INVALID_DRILL_DEPTH", `Feature "${feature.id}": hloubka vrtání musí být kladné číslo.`, "machiningLengthMm"));
    } else if (invalidLength) {
      issues.push(turningIssue("INVALID_MACHINING_LENGTH", `Feature "${feature.id}": 'machiningLengthMm' musí být kladné číslo.`, "machiningLengthMm"));
    }

    if (feature.subtype === "threading" && (!g.threadPitchMm || g.threadPitchMm <= 0)) {
      issues.push(turningIssue("INVALID_THREAD_PITCH", `Feature "${feature.id}": závit vyžaduje kladné 'threadPitchMm'.`, "threadPitchMm"));
    }

    const override = feature.cuttingConditionOverride;
    if (override?.cuttingSpeedMMin !== undefined && override.cuttingSpeedMMin <= 0) {
      issues.push(turningIssue("INVALID_CUTTING_SPEED", `Feature "${feature.id}": explicitní 'cuttingSpeedMMin' musí být kladné číslo.`, "cuttingSpeedMMin"));
    }
    if (override?.feedPerRevolutionMm !== undefined) {
      if (override.feedPerRevolutionMm < 0) {
        issues.push(turningIssue("INVALID_FEED_PER_REVOLUTION", `Feature "${feature.id}": explicitní 'feedPerRevolutionMm' nesmí být záporné.`, "feedPerRevolutionMm"));
      } else if (override.feedPerRevolutionMm === 0) {
        issues.push(turningIssue("FEED_RATE_ZERO", `Feature "${feature.id}": explicitní 'feedPerRevolutionMm' je nulové.`, "feedPerRevolutionMm"));
      }
    }
    if (feature.passStrategy?.passCount !== undefined && feature.passStrategy.passCount <= 0) {
      issues.push(turningIssue("INVALID_PASS_COUNT", `Feature "${feature.id}": 'passCount' musí být kladné celé číslo.`, "passCount"));
    }
    if (feature.passStrategy?.roughingDepthOfCutMm !== undefined && feature.passStrategy.roughingDepthOfCutMm <= 0) {
      issues.push(turningIssue("INVALID_DEPTH_OF_CUT", `Feature "${feature.id}": 'roughingDepthOfCutMm' musí být kladné číslo.`, "roughingDepthOfCutMm"));
    }

    return issues;
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const turningInput = input as TurningCalculationInput;
    const features = [...turningInput.features].sort((a, b) => a.sequence - b.sequence);

    const machine = context.machineProfileSnapshot ? readMachineProfileView(context.machineProfileSnapshot) : undefined;
    const material = context.materialProfileSnapshot ? readMaterialProfileView(context.materialProfileSnapshot) : undefined;
    const materialCoefficient = material?.materialCoefficient ?? 1;
    const machineCoefficient = machine?.performanceCoefficient ?? 1;

    const featureBreakdowns: TurningFeatureBreakdown[] = [];
    const toolSegments: ToolUsageSegment[] = [];
    const toolLifeByToolId = new Map<string, ToolLifeProfile>();
    const toolChangeTimeSecByToolId = new Map<string, number | undefined>();
    const warnings: CalculationIssue[] = [];

    let rawCuttingTimeMin = 0;
    let adjustedCuttingTimeMin = 0;
    let variableMeasurementTimeMin = 0;
    let firstPieceInspectionExtraMin = 0;
    let dwellTotalMin = 0;

    let usedSystemDefaultCuttingCondition = false;
    let missingConcreteTool = false;
    let toolLifeUnknownFlag = false;
    let rpmClampedFlag = false;
    let manualPassCountFlag = false;
    let powerModelUnknownFlag = false;

    let previousToolIdForContribution: string | undefined;

    for (const feature of features) {
      const toolSnapshot = context.toolProfileSnapshotsByFeatureId?.[feature.id];
      const toolView: ToolProfileView | undefined = toolSnapshot ? readToolProfileView(toolSnapshot) : undefined;
      if (feature.toolProfileId && !toolView) missingConcreteTool = true;
      if (!feature.toolProfileId) missingConcreteTool = true;

      const resolvedCondition = context.turningCuttingConditionsByFeatureId?.[feature.id];
      const override = feature.cuttingConditionOverride;

      const resolvedCuttingSpeed = resolveParameterValue(
        override?.cuttingSpeedMMin,
        resolvedCondition?.cuttingSpeedMMin,
        resolvedCondition?.cuttingSpeedSource,
        SYSTEM_DEFAULT_CUTTING_SPEED_MMIN
      );
      // §5/§6 "závit: jmenovitý průměr..." / "pro závit: stoupání závitu" -
      // stoupání JE posuv na otáčku (jednostartový závit), takže má přednost
      // před obecným systémovým defaultem, pokud nic konkrétnějšího
      // (explicit/vyřešená CuttingCondition) není k dispozici.
      const feedSystemDefault =
        feature.subtype === "threading" && feature.geometry.threadPitchMm !== undefined
          ? feature.geometry.threadPitchMm
          : SYSTEM_DEFAULT_FEED_PER_REV_MM;
      const resolvedFeed = resolveParameterValue(
        override?.feedPerRevolutionMm,
        resolvedCondition?.feedPerRevolutionMm,
        resolvedCondition?.feedSource,
        feedSystemDefault
      );
      if (resolvedCuttingSpeed.usedSystemDefault || resolvedFeed.usedSystemDefault) {
        usedSystemDefaultCuttingCondition = true;
      }
      const sourceOfEachResolvedParameter: Record<string, string> = {
        cuttingSpeed: resolvedCuttingSpeed.source,
        feedPerRevolution: resolvedFeed.source,
      };

      const cuttingResult = calculateFeatureCutting({
        feature,
        cuttingSpeedMMin: resolvedCuttingSpeed.value,
        feedPerRevolutionMm: resolvedFeed.value,
        machineMinRpm: machine?.minRpm,
        machineMaxRpm: machine?.maxRpm,
        toolMaxCuttingSpeedMMin: toolView?.maxCuttingSpeedMMin,
      });
      sourceOfEachResolvedParameter.spindleSpeed = feature.cuttingConditionOverride?.spindleSpeedRpm !== undefined ? "explicit" : "derived";
      sourceOfEachResolvedParameter.passCount = cuttingResult.passCountManuallySpecified ? "explicit" : "auto";

      warnings.push(...cuttingResult.warnings);
      if (cuttingResult.clampedToMachineLimit) rpmClampedFlag = true;
      if (cuttingResult.passCountManuallySpecified) manualPassCountFlag = true;

      const featureToolId = feature.toolProfileId;
      if (toolView && featureToolId) {
        warnings.push(...checkToolMaterialCompatibility(toolView, material?.materialGroupId ?? ""));
        const toolLife = ToolLifeProfile.fromJSON(toolView.toolLife);
        toolLifeByToolId.set(featureToolId, toolLife);
        toolChangeTimeSecByToolId.set(featureToolId, toolView.toolChangeTimeSec);
        if (toolLife.isUnknown) toolLifeUnknownFlag = true;
      }

      const depthOfCutMm =
        feature.passStrategy?.roughingDepthOfCutMm ?? (cuttingResult.totalPasses > 0 ? cuttingResult.radialStockMm / cuttingResult.totalPasses : 0);
      const powerEstimate = this.powerEstimator.estimate({
        cuttingSpeedMMin: cuttingResult.cuttingSpeedMMin,
        depthOfCutMm,
        feedPerRevolutionMm: cuttingResult.feedPerRevolutionMm,
        materialCoefficient,
      });
      if (machine) {
        const { issues: powerIssues } = checkPowerAndTorque(powerEstimate.requiredPowerKw, cuttingResult.spindleSpeedRpm, machine);
        warnings.push(...powerIssues);
      } else {
        powerModelUnknownFlag = true;
      }

      const toolWearFactor = toolView ? ToolWearCurve.fromJSON(toolView.wearFactorCurve).factorAt(turningInput.quantity) : 1;
      const coefficients = resolveTurningCoefficients({
        machineCoefficient,
        materialCoefficient,
        complexityCoefficient: turningInput.complexityCoefficient,
        operatorSkillCoefficient: turningInput.operatorSkillCoefficient,
        toolWearFactor,
        interruptedCut: feature.interruptedCut ?? false,
        internalMachining: feature.internalMachining ?? false,
        machiningMode: feature.machiningMode,
      });

      const featureAdjustedCuttingTimeMin = cuttingResult.totalCuttingTimeMin * coefficients.combinedCuttingTimeCoefficient;
      rawCuttingTimeMin += cuttingResult.totalCuttingTimeMin;
      adjustedCuttingTimeMin += featureAdjustedCuttingTimeMin;
      dwellTotalMin += cuttingResult.dwellTimeMin;

      let measurementContributionMin = 0;
      if (feature.measurementRequirement === "every_piece") {
        measurementContributionMin = turningInput.measurementTimePerPieceMin ?? 0;
        variableMeasurementTimeMin += measurementContributionMin;
      } else if (feature.measurementRequirement === "sampling") {
        measurementContributionMin = (turningInput.measurementTimePerPieceMin ?? 0) / 2;
        variableMeasurementTimeMin += measurementContributionMin;
      } else if (feature.measurementRequirement === "first_piece") {
        measurementContributionMin = turningInput.measurementTimePerPieceMin ?? 0;
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
        cuttingTimePerPieceMin: cuttingResult.totalCuttingTimeMin,
        manualPlannedToolChanges: feature.plannedToolChanges,
      });

      featureBreakdowns.push({
        featureId: feature.id,
        subtype: feature.subtype,
        machiningMode: feature.machiningMode,
        sourceGeometry: feature.geometry,
        effectiveDiameterMm: cuttingResult.effectiveDiameterMm,
        cuttingSpeedMMin: cuttingResult.cuttingSpeedMMin,
        spindleSpeedRpm: cuttingResult.spindleSpeedRpm,
        spindleSpeedSource: cuttingResult.spindleSpeedSource,
        feedPerRevolutionMm: cuttingResult.feedPerRevolutionMm,
        feedRateMmMin: cuttingResult.feedRateMmMin,
        cuttingLengthMm: cuttingResult.cuttingLengthMm,
        radialStockMm: cuttingResult.radialStockMm,
        axialStockMm: cuttingResult.axialStockMm,
        roughingPasses: cuttingResult.roughingPasses,
        finishingPasses: cuttingResult.finishingPasses,
        springPasses: cuttingResult.springPasses,
        totalPasses: cuttingResult.totalPasses,
        cuttingTimePerPassMin: cuttingResult.cuttingTimePerPassMin,
        totalCuttingTimeMin: featureAdjustedCuttingTimeMin,
        dwellTimeMin: cuttingResult.dwellTimeMin,
        toolChangeContributionMin,
        measurementContributionMin,
        coefficientBreakdown: coefficients.contributions,
        warnings: cuttingResult.warnings,
        sourceOfEachResolvedParameter,
      });
    }

    const toolChangeAccounting = accountForToolChanges({
      segments: toolSegments,
      quantity: turningInput.quantity,
      toolLifeByToolId,
      toolChangeTimeSecByToolId,
    });
    if (toolChangeAccounting.toolIdsWithUnknownLife.length > 0) toolLifeUnknownFlag = true;
    if (toolLifeUnknownFlag) {
      warnings.push(turningIssue("TOOL_LIFE_UNKNOWN", "Aspoň jeden použitý nástroj má neznámou životnost."));
    }
    if (usedSystemDefaultCuttingCondition) {
      warnings.push(turningIssue("CUTTING_CONDITION_DEFAULTED", "Aspoň pro jeden feature se použila systémová výchozí řezná podmínka."));
    }
    if (manualPassCountFlag) {
      warnings.push(turningIssue("MANUAL_PASS_COUNT_USED", "Aspoň jeden feature měl ručně zadaný počet průchodů."));
    }

    const confidenceSignals: ConfidenceSignals = {
      usedSystemDefaultCuttingCondition,
      missingConcreteTool,
      toolLifeUnknown: toolLifeUnknownFlag,
      rpmClampedToMachineLimit: rpmClampedFlag,
      unknownPowerModel: powerModelUnknownFlag,
      manualPassCountWithoutGeometryCheck: manualPassCountFlag,
      manualOverrideUsed: toolChangeAccounting.manuallyOverridden,
      missingCalibrationData: context.calibrationProfileId === undefined,
    };
    const confidenceBreakdown = computeConfidence(confidenceSignals);
    const recommendations: CalculationIssue[] = [];
    if (confidenceBreakdown.finalScore < 0.6) {
      recommendations.push(
        turningIssue("LOW_CONFIDENCE_RESULT", `Výsledek má nízkou důvěryhodnost (${confidenceBreakdown.finalScore.toFixed(2)}) - doporučuje se ruční kontrola.`)
      );
    }

    const setupTimeMin = turningInput.setupTimeMin ?? 0;
    const handlingTimeMin = turningInput.handlingTimePerPieceMin ?? 0;
    const firstPieceInspectionTimeMin = (turningInput.firstPieceInspectionTimeMin ?? 0) + firstPieceInspectionExtraMin;
    const finalInspectionTimeMin = turningInput.finalInspectionTimeMin ?? 0;
    const toolChangeTimeMin = toolChangeAccounting.totalToolChangeTimeMin;
    const complexityCoefficientReal = turningInput.complexityCoefficient ?? 1;
    const operatorSkillCoefficientReal = turningInput.operatorSkillCoefficient ?? 1;
    const plannedFixtureChanges = features.reduce((sum, f) => sum + (f.fixtureChangeCount ?? 0), 0);

    // Všech šest základních (Fáze A) koeficientů je tu ZÁMĚRNĚ neutrálních
    // (1) - `TurningCalculationStrategy` aplikuje SPRÁVNĚ rozřazené
    // koeficienty (§10) SAMA, na úrovni jednotlivých featurů, PŘED tímhle
    // místem (`adjustedCuttingTimeMin`, `handlingTimeMin × operatorSkill`,
    // `setupTimeMin × complexity`). Kdyby se reálné hodnoty vyplnily i sem,
    // existující gettery `CalculationBreakdown` (Fáze A, neměnit) by je
    // aplikovaly ZNOVU (dvojí započtení). Skutečné hodnoty pro
    // transparentnost nese `turningDetail.features[].coefficientBreakdown`
    // (§10 "neslučuj do jednoho anonymního čísla").
    const props = {
      rawUnitTime: Time.ofMinutes(adjustedCuttingTimeMin),
      setupTime: Time.ofMinutes(setupTimeMin * complexityCoefficientReal),
      firstPieceInspectionTime: Time.ofMinutes(firstPieceInspectionTimeMin),
      finalInspectionTime: Time.ofMinutes(finalInspectionTimeMin),
      toolChangeTime: Time.ofMinutes(toolChangeAccounting.totalToolChanges > 0 ? toolChangeTimeMin / toolChangeAccounting.totalToolChanges : 0),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.ofMinutes(handlingTimeMin * operatorSkillCoefficientReal),
      inOperationInspectionTime: Time.ofMinutes(variableMeasurementTimeMin),
      measurementTime: Time.zero(),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.ofMinutes(dwellTotalMin),
      waitingTime: Time.zero(),
      quantity: Quantity.ofPieces(turningInput.quantity),
      plannedToolChanges: toolChangeAccounting.totalToolChanges,
      plannedFixtureChanges,
      operatorSkillCoefficient: 1,
      machineCoefficient: 1,
      materialCoefficient: 1,
      complexityCoefficient: 1,
      toolWearCoefficient: 1,
      historicalCalibrationCoefficient: 1,
      percentageAllowance: turningInput.percentageAllowance ?? 0,
      fixedAllowance: Time.ofMinutes(turningInput.fixedAllowanceMin ?? 0),
    };

    // Sestaví se DVAKRÁT: poprvé jen pro čtení odvozených součtů (gettery),
    // podruhé s `turningDetail` pro skutečný návrat - zaručuje, že `turning
    // Detail.totalOperationTimeMin` NIKDY neuteče ze synchronizace se
    // skutečným `CalculationBreakdown.totalOperationTime` (jediný zdroj
    // pravdy jsou gettery Fáze A, ne druhý, ručně psaný vzorec vedle nich).
    const computed = CalculationBreakdown.create(props);

    const turningDetail: TurningCalculationBreakdown = {
      setupTimeMin,
      firstPieceInspectionTimeMin,
      finalInspectionTimeMin,
      rawCuttingTimeMin,
      adjustedCuttingTimeMin,
      handlingTimeMin,
      measurementTimeMin: variableMeasurementTimeMin,
      toolChangeTimeMin,
      fixtureChangeTimeMin: 0,
      auxiliaryTimeMin: dwellTotalMin,
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

    return CalculationBreakdown.create({ ...props, turningDetail });
  }
}
