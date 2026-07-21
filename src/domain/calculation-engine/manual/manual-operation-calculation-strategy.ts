import type { OperationCategory } from "../enums/operation-category";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";
import { CalculationStrategy } from "../services/calculation-strategy";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";

import { ManualOperationCalculationInput } from "./manual-operation-calculation-input";
import { ManualOperationFeature } from "./manual-operation-feature";
import { resolveManualCoefficients } from "./manual-coefficients";
import { computeConfidence, ConfidenceSignals } from "./manual-confidence";
import { manualIssue } from "./manual-issue-codes";
import { ManualOperationFeatureBreakdown, ManualCalculationBreakdown } from "./manual-calculation-breakdown";
import { readManualTimeStandardView } from "./manual-context-views";
import { syntheticManualFeatures as syntheticFeatures } from "./manual-synthetic-features";

/** MVP systémový výchozí čas (min), POUZE pokud žádný jiný zdroj (explicit,
 *  vyřešený `ManualTimeStandard`) neposkytl hodnotu - stejná filozofie jako
 *  Fáze C `SYSTEM_DEFAULT_CUTTING_SPEED_MMIN`. */
const SYSTEM_DEFAULT_BASE_TIME_MIN = 1;

/**
 * `ManualOperationCalculationStrategy` (AP-MCE-001 Fáze F) - pátá
 * plnohodnotná implementace `CalculationStrategy` (po Fázi C/D/E), stejná
 * strukturální kostra (viz `TurningCalculationStrategy` pro plné
 * zdůvodnění vzoru). Na rozdíl od technologických strategií NEZÁVISÍ na
 * strojním řezném čase - "čas" tu vzniká ze standardů/šablon/explicitních
 * odhadů, ne z fyzikálního vzorce řezné rychlosti/posuvu.
 */
export class ManualOperationCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "manual";
  readonly strategyVersion = "manual-operation-1.0.0";

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const manualInput = input as ManualOperationCalculationInput;
    const issues: CalculationIssue[] = [];

    if (!Number.isInteger(manualInput.quantity) || manualInput.quantity <= 0) {
      issues.push(manualIssue("INVALID_REPETITION_COUNT", `'quantity' musí být kladné celé číslo, dostal jsem "${manualInput.quantity}".`));
    }
    if ((!manualInput.features || manualInput.features.length === 0) && manualInput.baseUnitTimeMin === undefined) {
      issues.push(manualIssue("INVALID_BASE_TIME", "Operace bez 'features' musí mít vyplněné 'baseUnitTimeMin'."));
    }

    for (const feature of syntheticFeatures(manualInput)) {
      issues.push(...this.validateFeature(feature));
    }

    return issues;
  }

  private validateFeature(feature: ManualOperationFeature): CalculationIssue[] {
    const issues: CalculationIssue[] = [];

    if (feature.timeBasis === "explicit" && (feature.baseTimeMin === undefined || feature.baseTimeMin < 0)) {
      issues.push(manualIssue("INVALID_BASE_TIME", `Feature "${feature.id}": explicitní 'baseTimeMin' musí být nezáporné číslo.`, "baseTimeMin"));
    }
    if (feature.baseTimeMin !== undefined && feature.baseTimeMin < 0) {
      issues.push(manualIssue("INVALID_BASE_TIME", `Feature "${feature.id}": 'baseTimeMin' nesmí být záporné.`, "baseTimeMin"));
    }
    if (feature.repetitionCount !== undefined && (!Number.isInteger(feature.repetitionCount) || feature.repetitionCount <= 0)) {
      issues.push(manualIssue("INVALID_REPETITION_COUNT", `Feature "${feature.id}": 'repetitionCount' musí být kladné celé číslo.`, "repetitionCount"));
    }

    return issues;
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const manualInput = input as ManualOperationCalculationInput;
    const features = [...syntheticFeatures(manualInput)].sort((a, b) => a.sequence - b.sequence);

    const featureBreakdowns: ManualOperationFeatureBreakdown[] = [];
    const warnings: CalculationIssue[] = [];

    let perPieceFeatureTimeMin = 0;
    let batchFixedFeatureTimeMin = 0;
    let rawManualTimeMin = 0;
    let adjustedManualTimeMin = 0;

    let usedSystemDefault = false;
    let missingTenantStandard = false;
    let missingHistoricalData = false;
    let manualEstimateWithoutTemplate = false;
    let unknownQualification = false;
    let tooGenericSubtype = false;

    for (const feature of features) {
      const repetitionCount = feature.repetitionCount ?? 1;
      const standardSnapshot = context.manualTimeStandardsByFeatureId?.[feature.id];
      const standardView = standardSnapshot ? readManualTimeStandardView(standardSnapshot) : undefined;

      let baseTimeMin: number;
      let source: string;
      if (feature.timeBasis === "explicit") {
        baseTimeMin = feature.baseTimeMin ?? 0;
        source = "explicit";
      } else if (standardView) {
        baseTimeMin = standardView.baseTimeMin;
        source = standardView.source;
        if (standardView.source === "system_default") missingTenantStandard = true;
      } else if (feature.baseTimeMin !== undefined) {
        baseTimeMin = feature.baseTimeMin;
        source = `${feature.timeBasis}_stale`;
        missingTenantStandard = true;
        if (feature.timeBasis === "historical_average") missingHistoricalData = true;
        warnings.push(manualIssue("MANUAL_STANDARD_NOT_FOUND", `Feature "${feature.id}": standard pro '${feature.timeBasis}' nebyl nalezen, použita poslední známá hodnota.`));
      } else {
        baseTimeMin = SYSTEM_DEFAULT_BASE_TIME_MIN;
        source = "system_default";
        usedSystemDefault = true;
        missingTenantStandard = true;
        if (feature.timeBasis === "historical_average") missingHistoricalData = true;
        warnings.push(manualIssue("MANUAL_STANDARD_DEFAULTED", `Feature "${feature.id}": nebyl nalezen žádný standard, použita systémová výchozí hodnota.`));
      }
      if (feature.timeBasis === "explicit") manualEstimateWithoutTemplate = true;
      if (feature.subtype === "custom_manual") tooGenericSubtype = true;

      const sourceOfEachResolvedParameter: Record<string, string> = { baseTime: source };

      let qualificationRequirement: string | undefined;
      if (feature.employeeQualificationId) {
        qualificationRequirement = feature.employeeQualificationId;
        const satisfiedBy = [manualInput.employeeQualificationId, ...(manualInput.requiredQualificationIds ?? [])].filter((id): id is string => id !== undefined);
        if (!satisfiedBy.includes(feature.employeeQualificationId)) {
          unknownQualification = true;
          warnings.push(manualIssue("REQUIRED_QUALIFICATION_MISSING", `Feature "${feature.id}" vyžaduje kvalifikaci "${feature.employeeQualificationId}", operátor ji nemá přiřazenou.`));
        }
      }
      if (feature.workstationRequirement && manualInput.workstationId && feature.workstationRequirement !== manualInput.workstationId) {
        warnings.push(manualIssue("WORKSTATION_UNAVAILABLE", `Feature "${feature.id}" vyžaduje pracoviště "${feature.workstationRequirement}", operace je zadaná na jiném.`));
      }

      const coefficients = resolveManualCoefficients({
        complexityCoefficient: manualInput.complexityCoefficient,
        operatorSkillCoefficient: manualInput.operatorSkillCoefficient,
        ergonomicCoefficient: manualInput.ergonomicCoefficient,
        fatigueCoefficient: manualInput.fatigueCoefficient,
        workplaceCoefficient: manualInput.workplaceCoefficient,
        ergonomicDemand: feature.ergonomicDemand,
        complexityLevel: feature.complexityLevel,
        productionSeriality: manualInput.productionSeriality,
      });

      const rawFeatureTimeMin = baseTimeMin * repetitionCount;
      const adjustedFeatureTimeMin = rawFeatureTimeMin * coefficients.combinedManualTimeCoefficient;
      rawManualTimeMin += rawFeatureTimeMin;
      adjustedManualTimeMin += adjustedFeatureTimeMin;

      if (feature.quantityBasis === "per_piece") {
        perPieceFeatureTimeMin += adjustedFeatureTimeMin;
      } else if (feature.quantityBasis === "per_batch") {
        const batchCount = manualInput.batchSize && manualInput.batchSize > 0 ? Math.ceil(manualInput.quantity / manualInput.batchSize) : 1;
        batchFixedFeatureTimeMin += adjustedFeatureTimeMin * batchCount;
      } else {
        // per_order / per_occurrence - jednou (respektive `repetitionCount`-krát,
        // to je už zahrnuto v `adjustedFeatureTimeMin`) za CELOU operaci.
        batchFixedFeatureTimeMin += adjustedFeatureTimeMin;
      }

      featureBreakdowns.push({
        featureId: feature.id,
        subtype: feature.subtype,
        quantityBasis: feature.quantityBasis,
        repetitionCount,
        baseTimeMin,
        adjustedTimeMin: adjustedFeatureTimeMin,
        source,
        coefficientBreakdown: coefficients.contributions,
        qualificationRequirement,
        warnings: [],
        sourceOfEachResolvedParameter,
      });
    }

    if (tooGenericSubtype) warnings.push(manualIssue("MANUAL_STANDARD_DEFAULTED", "Aspoň jeden feature používá obecný podtyp 'custom_manual'."));

    const confidenceSignals: ConfidenceSignals = {
      usedSystemDefault,
      missingTenantStandard,
      missingHistoricalData,
      manualEstimateWithoutTemplate,
      unknownQualification,
      manualOverrideUsed: manualEstimateWithoutTemplate,
      tooGenericSubtype,
    };
    const confidenceBreakdown = computeConfidence(confidenceSignals);
    const recommendations: CalculationIssue[] = [];
    if (confidenceBreakdown.finalScore < 0.6) {
      recommendations.push(manualIssue("LOW_CONFIDENCE_RESULT", `Výsledek má nízkou důvěryhodnost (${confidenceBreakdown.finalScore.toFixed(2)}) - doporučuje se ruční kontrola.`));
    }

    const setupTimeMin = manualInput.setupTimeMin ?? 0;
    const preparationTimeMin = manualInput.preparationTimeMin ?? 0;
    const cleanupTimeMin = manualInput.cleanupTimeMin ?? 0;
    const handlingTimeMin = manualInput.handlingTimePerPieceMin ?? 0;
    const auxiliaryTimeMin = manualInput.auxiliaryTimePerPieceMin ?? 0;
    const waitingTimeMin = (manualInput.waitingTimeMin ?? 0) + (manualInput.interBatchTimeMin ?? 0);
    const operatorSkillCoefficientReal = manualInput.operatorSkillCoefficient ?? 1;

    // Všech šest základních (Fáze A) koeficientů je tu ZÁMĚRNĚ neutrálních
    // (1) - stejný důvod jako Fáze C-E (koeficienty se aplikují SAMY, per
    // feature, PŘED tímhle místem - zabránění dvojímu započtení).
    const props = {
      rawUnitTime: Time.ofMinutes(perPieceFeatureTimeMin),
      setupTime: Time.ofMinutes(setupTimeMin + preparationTimeMin + cleanupTimeMin + batchFixedFeatureTimeMin),
      firstPieceInspectionTime: Time.ofMinutes(manualInput.firstPieceTimeMin ?? 0),
      finalInspectionTime: Time.zero(),
      toolChangeTime: Time.zero(),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.ofMinutes(handlingTimeMin * operatorSkillCoefficientReal),
      inOperationInspectionTime: Time.ofMinutes(auxiliaryTimeMin),
      measurementTime: Time.zero(),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.zero(),
      waitingTime: Time.ofMinutes(waitingTimeMin),
      quantity: Quantity.ofPieces(manualInput.quantity),
      plannedToolChanges: 0,
      plannedFixtureChanges: 0,
      operatorSkillCoefficient: 1,
      machineCoefficient: 1,
      materialCoefficient: 1,
      complexityCoefficient: 1,
      toolWearCoefficient: 1,
      historicalCalibrationCoefficient: 1,
      percentageAllowance: manualInput.percentageAllowance ?? 0,
      fixedAllowance: Time.ofMinutes(manualInput.fixedAllowanceMin ?? 0),
    };

    const computed = CalculationBreakdown.create(props);

    const manualDetail: ManualCalculationBreakdown = {
      setupTimeMin,
      preparationTimeMin,
      rawManualTimeMin,
      adjustedManualTimeMin,
      handlingTimeMin,
      auxiliaryTimeMin,
      cleanupTimeMin,
      waitingTimeMin,
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
      strategyVersion: this.strategyVersion,
      algorithmVersion: "mce-v1",
    };

    return CalculationBreakdown.create({ ...props, manualDetail });
  }
}
