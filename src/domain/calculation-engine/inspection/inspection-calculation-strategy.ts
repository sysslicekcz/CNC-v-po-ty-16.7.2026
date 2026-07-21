import type { OperationCategory } from "../enums/operation-category";
import { OperationCalculationInputBase } from "../contracts/operation-calculation-input";
import { CalculationContext } from "../contracts/calculation-context";
import { CalculationBreakdown } from "../entities/calculation-breakdown";
import { CalculationIssue } from "../entities/types";
import { CalculationStrategy } from "../services/calculation-strategy";
import { Time } from "../value-objects/time";
import { Quantity } from "../value-objects/quantity";

import { InspectionCalculationInput } from "./inspection-calculation-input";
import { InspectionFeature } from "./inspection-feature";
import { resolveSampleCount, SamplingPlanResult } from "./inspection-sampling-strategy";
import { resolveInspectionCoefficients } from "./inspection-coefficients";
import { computeInspectionConfidence, InspectionConfidenceSignals } from "./inspection-confidence";
import { inspectionIssue } from "./inspection-issue-codes";
import { InspectionFeatureBreakdown, InspectionCalculationBreakdown } from "./inspection-calculation-breakdown";
import { readInspectionEquipmentView } from "./inspection-context-views";
import { syntheticInspectionFeatures as syntheticFeatures } from "./inspection-synthetic-features";

/**
 * `InspectionCalculationStrategy` (AP-MCE-001 Fáze F §6-§16) - stejná
 * struktura jako `ManualOperationCalculationStrategy`: `validate()` vrací jen
 * blokující chyby, `calculate()` prochází seřazené `InspectionFeature`,
 * dopočítá `inspectedPieceCount` (§8), rozpadne čas na Fixed/Variable/Closing
 * (§10), u CMM/automatizovaného vybavení odděleně sleduje strojní cyklus a
 * čas obsluhy (§11), a stejným "double construction" vzorem zaručí, že
 * `inspectionDetail.totalOperationTimeMin` nikdy nezmění hodnotu nezávisle na
 * `CalculationBreakdown` getterech (JEDEN zdroj pravdy).
 *
 * DŮLEŽITÉ (na rozdíl od Turning/Milling/Grinding/Manual): `measurementTimeMin`/
 * `handlingTimeMin`/`documentationTimeMin` škálují se `inspectedPieceCount`
 * (kolik kusů se SKUTEČNĚ kontroluje), NE s `quantity` (kolik kusů je v
 * dávce) - ty dvě čísla se rovnají jen u `every_piece` sampling módu.
 * `CalculationBreakdown.batchVariableTime` ale VŽDY násobí `rawUnitTime`
 * počtem kusů (`quantity.pieces`) - kdybychom do něj dali už-agregovaný
 * čas, znásobilo by se to podruhé. Proto se všechny už-spočítané součty
 * routují do polí, která base třída NEnásobí kusy (`measurementTime`/
 * `setupTime`/`finalInspectionTime`) - `rawUnitTime`/`handlingTime`/
 * `inOperationInspectionTime` zůstávají nula (stejná disciplína jako
 * `ManualOperationCalculationStrategy`).
 *
 * MVP zjednodušení (zdokumentováno, stejná disciplína jako u předchozích
 * fází): "DocumentationSetupTime" a "FinalReleaseTime" ze vzorce §10 nemají
 * v §6 vlastní vstupní pole - `DocumentationSetupTime` se skládá do
 * `equipmentSetupTimeMin` (přes `setupTimeMin`), `FinalReleaseTime` do
 * `reportTimeMin`. `calibrationCoefficient` (`historicalCalibrationCoefficient`)
 * se aplikuje AŽ NA CELÝ souhrnný raw čas (§10 "až jako schválenou historickou
 * korekci"), ne po jednotlivých blocích jako zbylé čtyři koeficienty.
 */
export class InspectionCalculationStrategy implements CalculationStrategy {
  readonly operationCategory: OperationCategory = "inspection";
  readonly strategyVersion = "inspection-1.0.0";

  validate(input: OperationCalculationInputBase, context: CalculationContext): CalculationIssue[] {
    const inspectionInput = input as InspectionCalculationInput;
    const issues: CalculationIssue[] = [];

    if (!Number.isInteger(inspectionInput.quantity) || inspectionInput.quantity <= 0) {
      // Zadání pro Inspection nemá vlastní kód pro neplatné 'quantity' (na
      // rozdíl od ostatních fází) - `quantity` je základ pro VŠECHNY sampling
      // vzorce, proto se vědomě používá nejbližší dostupný kód.
      issues.push(inspectionIssue("INVALID_SAMPLE_SIZE", `'quantity' musí být kladné celé číslo, dostal jsem "${inspectionInput.quantity}".`));
    }

    for (const feature of syntheticFeatures(inspectionInput)) {
      issues.push(...this.validateFeature(feature, inspectionInput));
    }

    return issues;
  }

  private validateFeature(feature: InspectionFeature, input: InspectionCalculationInput): CalculationIssue[] {
    const issues: CalculationIssue[] = [];

    if (feature.characteristicCount !== undefined && (!Number.isInteger(feature.characteristicCount) || feature.characteristicCount <= 0)) {
      issues.push(inspectionIssue("INVALID_CHARACTERISTIC_COUNT", `Feature "${feature.id}": 'characteristicCount' musí být kladné celé číslo.`, "characteristicCount"));
    }

    const measurementTime = feature.measurementTimePerCharacteristicMin ?? input.measurementTimePerCharacteristicMin;
    if (measurementTime !== undefined && measurementTime < 0) {
      issues.push(inspectionIssue("INVALID_MEASUREMENT_TIME", `Feature "${feature.id}": 'measurementTimePerCharacteristicMin' nesmí být záporné.`, "measurementTimePerCharacteristicMin"));
    }

    const sampleSize = feature.sampleRule?.sampleSize ?? input.sampleSize;
    if (sampleSize !== undefined && (!Number.isInteger(sampleSize) || sampleSize <= 0)) {
      issues.push(inspectionIssue("INVALID_SAMPLE_SIZE", `Feature "${feature.id}": 'sampleSize' musí být kladné celé číslo.`, "sampleSize"));
    }

    const frequency = feature.sampleRule?.frequency ?? input.samplingFrequency;
    if (frequency !== undefined && (!Number.isInteger(frequency) || frequency <= 0)) {
      issues.push(inspectionIssue("INVALID_SAMPLING_FREQUENCY", `Feature "${feature.id}": 'samplingFrequency' musí být kladné celé číslo.`, "samplingFrequency"));
    }

    return issues;
  }

  calculate(input: OperationCalculationInputBase, context: CalculationContext): CalculationBreakdown {
    const inspectionInput = input as InspectionCalculationInput;
    const features = [...syntheticFeatures(inspectionInput)].sort((a, b) => a.sequence - b.sequence);

    const featureBreakdowns: InspectionFeatureBreakdown[] = [];
    const warnings: CalculationIssue[] = [];

    let preparationTimeMin = inspectionInput.preparationTimeMin ?? 0;
    let equipmentSetupTimeMin =
      (inspectionInput.setupTimeMin ?? 0) +
      (inspectionInput.programCreationTimeMin ?? 0) +
      (inspectionInput.programLoadTimeMin ?? 0) +
      (inspectionInput.fixtureSetupTimeMin ?? 0);
    let measurementTimeMin = 0;
    let handlingTimeMin = 0;
    let documentationTimeMin = 0;
    let reportTimeMin = inspectionInput.reportTimeMin ?? 0;
    let cleanupTimeMin = inspectionInput.cleanupTimeMin ?? 0;
    let automaticCycleTimeMin = 0;
    let operatorAttendanceTimeMin = 0;
    let maxInspectedPieceCount = 0;

    let unknownEquipment = false;
    let missingMeasurementStandard = false;
    let invalidCalibration = false;
    let manualTimeWithoutSource = false;
    let unknownSamplingPlan = false;
    let manualOverride = false;
    let unknownCharacteristicCount = false;
    const missingHistoricalData = inspectionInput.calibrationProfileId === undefined;

    if (!inspectionInput.programCreationTimeMin && features.some((f) => f.subtype === "dimensional_cmm")) {
      warnings.push(inspectionIssue("CMM_PROGRAM_TIME_UNKNOWN", "CMM feature bez 'programCreationTimeMin' - strojní čas může být podhodnocený."));
    }

    for (const feature of features) {
      const equipmentId = feature.equipmentId ?? inspectionInput.inspectionEquipmentIds?.[0];
      const equipmentSnapshot = context.inspectionEquipmentSnapshotsByFeatureId?.[feature.id];
      const equipmentView = equipmentSnapshot ? readInspectionEquipmentView(equipmentSnapshot) : undefined;

      if (equipmentId && !equipmentView) {
        unknownEquipment = true;
        warnings.push(inspectionIssue("INSPECTION_EQUIPMENT_NOT_FOUND", `Feature "${feature.id}": vybavení "${equipmentId}" nebylo nalezeno, použit obecný odhad.`));
      }
      if (equipmentView && !equipmentView.supportedInspectionSubtypes.includes(feature.subtype) && equipmentView.supportedInspectionSubtypes.length > 0) {
        warnings.push(inspectionIssue("INSPECTION_EQUIPMENT_UNSUITABLE", `Feature "${feature.id}": vybavení "${equipmentId}" nepodporuje podtyp "${feature.subtype}".`));
      }
      if (context.inspectionEquipmentCalibrationExpiredByFeatureId?.[feature.id]) {
        invalidCalibration = true;
        warnings.push(inspectionIssue("EQUIPMENT_CALIBRATION_EXPIRED", `Feature "${feature.id}": kalibrace vybavení "${equipmentId}" je prošlá.`));
      }

      const sampleRule = feature.sampleRule ?? (inspectionInput.samplingPlan ? { mode: inspectionInput.samplingPlan, frequency: inspectionInput.samplingFrequency, sampleSize: inspectionInput.sampleSize } : undefined);
      const wasSamplingPlanMissing = sampleRule === undefined;
      if (wasSamplingPlanMissing) unknownSamplingPlan = true;

      let sampleResult: SamplingPlanResult;
      try {
        sampleResult = resolveSampleCount({
          mode: sampleRule?.mode ?? "every_piece",
          quantity: inspectionInput.quantity,
          frequency: sampleRule?.frequency,
          percentage: sampleRule?.percentage,
          sampleSize: sampleRule?.sampleSize,
          batchSize: sampleRule?.batchSize,
          explicitCount: sampleRule?.explicitCount,
        });
      } catch {
        sampleResult = resolveSampleCount({ mode: "every_piece", quantity: inspectionInput.quantity });
        unknownSamplingPlan = true;
        warnings.push(inspectionIssue("SAMPLING_RULE_DEFAULTED", `Feature "${feature.id}": neplatné parametry vzorkování, použita kontrola 100 %.`));
      }
      if (sampleResult.wasDefaulted) {
        unknownSamplingPlan = true;
        warnings.push(inspectionIssue("SAMPLING_RULE_DEFAULTED", `Feature "${feature.id}": chybí parametr pro '${sampleResult.mode}', použita zdokumentovaná výchozí hodnota.`));
      }
      const inspectedPieceCount = sampleResult.inspectedPieceCount;
      maxInspectedPieceCount = Math.max(maxInspectedPieceCount, inspectedPieceCount);

      let qualificationRequirement: string | undefined;
      if (feature.qualificationIds && feature.qualificationIds.length > 0) {
        const held = inspectionInput.requiredQualificationIds ?? [];
        const missing = feature.qualificationIds.filter((id) => !held.includes(id));
        if (missing.length > 0) {
          qualificationRequirement = missing.join(", ");
          warnings.push(inspectionIssue("QUALIFICATION_MISSING", `Feature "${feature.id}" vyžaduje kvalifikaci "${qualificationRequirement}", inspektor ji nemá přiřazenou.`));
        }
      }

      const characteristicCount = feature.characteristicCount ?? inspectionInput.characteristicCount;
      if (characteristicCount === undefined) unknownCharacteristicCount = true;
      const resolvedCharacteristicCount = characteristicCount ?? 1;

      const coefficients = resolveInspectionCoefficients({
        complexityCoefficient: inspectionInput.complexityCoefficient,
        accuracyCoefficient: inspectionInput.accuracyCoefficient,
        equipmentCoefficient: inspectionInput.equipmentCoefficient ?? equipmentView?.equipmentCoefficient,
        operatorSkillCoefficient: inspectionInput.operatorSkillCoefficient,
        documentationCoefficient: inspectionInput.documentationCoefficient,
        automationCoefficient: inspectionInput.automationCoefficient,
      });

      const measurementTimePerCharacteristicMin = feature.measurementTimePerCharacteristicMin ?? inspectionInput.measurementTimePerCharacteristicMin ?? 0;
      if (measurementTimePerCharacteristicMin > 0 && !equipmentView) manualTimeWithoutSource = true;
      if (measurementTimePerCharacteristicMin === 0 && !equipmentView) missingMeasurementStandard = true;
      if (feature.measurementTimePerCharacteristicMin !== undefined && feature.measurementTimePerCharacteristicMin !== inspectionInput.measurementTimePerCharacteristicMin) {
        manualOverride = true;
      }

      const automaticCyclePerCharMin = inspectionInput.automaticCycleTimePerCharacteristicMin ?? 0;
      const operatorAttendancePerCharMin = inspectionInput.operatorAttendanceTimePerCharacteristicMin ?? 0;
      const evaluationPerCharMin = inspectionInput.evaluationTimePerCharacteristicMin ?? 0;

      let automaticCycleTimeMinFeature = 0;
      let operatorAttendanceTimeMinFeature = 0;
      let measurementTimeMinFeature: number;

      const isAutomatedPath = automaticCyclePerCharMin > 0 || operatorAttendancePerCharMin > 0;
      if (isAutomatedPath) {
        automaticCycleTimeMinFeature = automaticCyclePerCharMin * resolvedCharacteristicCount * inspectedPieceCount;
        operatorAttendanceTimeMinFeature = operatorAttendancePerCharMin * resolvedCharacteristicCount * inspectedPieceCount;
        const evaluationTimeMinFeature = evaluationPerCharMin * resolvedCharacteristicCount * inspectedPieceCount;
        // §11 MVP rozhodnutí: strojní cyklus/čas obsluhy jsou skutečné,
        // naměřené hodnoty - koeficienty (lidský faktor) se na ně
        // neaplikují, jen na `evaluationTime` (vyhodnocení dělá člověk).
        measurementTimeMinFeature = Math.max(automaticCycleTimeMinFeature, operatorAttendanceTimeMinFeature) + evaluationTimeMinFeature * coefficients.combinedMeasurementCoefficient;
      } else {
        measurementTimeMinFeature = resolvedCharacteristicCount * measurementTimePerCharacteristicMin * inspectedPieceCount * coefficients.combinedMeasurementCoefficient;
        operatorAttendanceTimeMinFeature = measurementTimeMinFeature;
      }

      const handlingTimeMinFeature = inspectedPieceCount * (feature.handlingTimeMin ?? inspectionInput.partHandlingTimeMin ?? 0) * coefficients.combinedHandlingCoefficient;
      const documentationTimeMinFeature = inspectedPieceCount * (feature.documentationTimeMin ?? inspectionInput.documentationTimeMin ?? 0) * coefficients.combinedDocumentationCoefficient;
      const preparationTimeMinFeature = feature.preparationTimeMin ?? 0;
      const equipmentSetupTimeMinFeature = equipmentView?.setupTimeMin ?? 0;
      const reportTimeMinFeature = feature.reportTimeMin ?? 0;
      const cleanupTimeMinFeature = feature.cleanupTimeMin ?? 0;

      preparationTimeMin += preparationTimeMinFeature;
      equipmentSetupTimeMin += equipmentSetupTimeMinFeature;
      measurementTimeMin += measurementTimeMinFeature;
      handlingTimeMin += handlingTimeMinFeature;
      documentationTimeMin += documentationTimeMinFeature;
      reportTimeMin += reportTimeMinFeature;
      cleanupTimeMin += cleanupTimeMinFeature;
      automaticCycleTimeMin += automaticCycleTimeMinFeature;
      operatorAttendanceTimeMin += operatorAttendanceTimeMinFeature;

      featureBreakdowns.push({
        featureId: feature.id,
        subtype: feature.subtype,
        inspectionLevel: feature.inspectionLevel,
        quantity: inspectionInput.quantity,
        inspectedPieceCount,
        characteristicCount: resolvedCharacteristicCount,
        sampleRule: sampleResult,
        preparationTimeMin: preparationTimeMinFeature,
        measurementTimeMin: measurementTimeMinFeature,
        handlingTimeMin: handlingTimeMinFeature,
        documentationTimeMin: documentationTimeMinFeature,
        reportTimeMin: reportTimeMinFeature,
        automaticCycleTimeMin: automaticCycleTimeMinFeature,
        operatorAttendanceTimeMin: operatorAttendanceTimeMinFeature,
        equipmentUsed: equipmentId,
        coefficientBreakdown: coefficients.contributions,
        warnings: [],
        sourceOfEachResolvedParameter: { samplingMode: sampleResult.mode },
      });

      if (qualificationRequirement) {
        // Poznámka do breakdown patří na feature - varování je už výš v
        // hlavním `warnings` poli operace.
      }
    }

    const confidenceSignals: InspectionConfidenceSignals = {
      unknownEquipment,
      missingMeasurementStandard,
      invalidCalibration,
      manualTimeWithoutSource,
      unknownSamplingPlan,
      missingHistoricalData,
      manualOverride,
      unknownCharacteristicCount,
    };
    const confidenceBreakdown = computeInspectionConfidence(confidenceSignals);
    const recommendations: CalculationIssue[] = [];
    if (confidenceBreakdown.finalScore < 0.6) {
      recommendations.push(inspectionIssue("LOW_CONFIDENCE_RESULT", `Výsledek má nízkou důvěryhodnost (${confidenceBreakdown.finalScore.toFixed(2)}) - doporučuje se ruční kontrola.`));
    }

    const historicalCalibrationCoefficient = inspectionInput.historicalCalibrationCoefficient ?? 1;
    const fixedTimeMinRaw = (preparationTimeMin + equipmentSetupTimeMin) * historicalCalibrationCoefficient;
    const variableTimeMinRaw = (measurementTimeMin + handlingTimeMin + documentationTimeMin) * historicalCalibrationCoefficient;
    const closingTimeMinRaw = (reportTimeMin + cleanupTimeMin) * historicalCalibrationCoefficient;

    // Viz komentář u třídy - `fixedTimeMinRaw`/`variableTimeMinRaw`/
    // `closingTimeMinRaw` jsou UŽ agregované za celou dávku (škálují se
    // `inspectedPieceCount`, ne `quantity`), proto jdou do polí, která
    // `CalculationBreakdown` nenásobí počtem kusů (`setupTime`/
    // `measurementTime`/`finalInspectionTime`). `rawUnitTime`/`handlingTime`/
    // `inOperationInspectionTime` zůstávají nula.
    const props = {
      rawUnitTime: Time.zero(),
      setupTime: Time.ofMinutes(fixedTimeMinRaw),
      firstPieceInspectionTime: Time.zero(),
      finalInspectionTime: Time.ofMinutes(closingTimeMinRaw),
      toolChangeTime: Time.zero(),
      fixtureChangeTime: Time.zero(),
      handlingTime: Time.zero(),
      inOperationInspectionTime: Time.zero(),
      measurementTime: Time.ofMinutes(variableTimeMinRaw),
      interOperationMoveTime: Time.zero(),
      auxiliaryTime: Time.zero(),
      waitingTime: Time.zero(),
      quantity: Quantity.ofPieces(inspectionInput.quantity),
      plannedToolChanges: 0,
      plannedFixtureChanges: 0,
      operatorSkillCoefficient: 1,
      machineCoefficient: 1,
      materialCoefficient: 1,
      complexityCoefficient: 1,
      toolWearCoefficient: 1,
      historicalCalibrationCoefficient: 1,
      percentageAllowance: inspectionInput.percentageAllowance ?? 0,
      fixedAllowance: Time.ofMinutes(inspectionInput.fixedAllowanceMin ?? 0),
    };

    const computed = CalculationBreakdown.create(props);

    const inspectionDetail: InspectionCalculationBreakdown = {
      preparationTimeMin,
      equipmentSetupTimeMin,
      measurementTimeMin,
      handlingTimeMin,
      documentationTimeMin,
      reportTimeMin,
      cleanupTimeMin,
      automaticCycleTimeMin,
      operatorAttendanceTimeMin,
      inspectedPieceCount: maxInspectedPieceCount,
      totalOperationTimeMin: computed.totalOperationTime.minutes,
      effectiveUnitTimeMin: computed.totalOperationTime.minutes / inspectionInput.quantity,
      confidenceScore: confidenceBreakdown.finalScore,
      confidenceBreakdown,
      warnings,
      recommendations,
      features: featureBreakdowns,
      strategyVersion: this.strategyVersion,
      algorithmVersion: "mce-v1",
    };

    return CalculationBreakdown.create({ ...props, inspectionDetail });
  }
}
