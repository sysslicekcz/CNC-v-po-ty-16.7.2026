import { LocalTenantContext } from "@/infrastructure/services/local-tenant-context";
import { IndexedDbTenantRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tenant-repository";
import { LocalLicenseProvider } from "@/infrastructure/licensing/local-license-provider";
import { DevelopmentLicenseProvider } from "@/infrastructure/licensing/development-license-provider";
import { IndexedDbLicenseRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-license-repository";
import { DefaultFeatureAccessService } from "@/application/licensing/default-feature-access-service";
import { GetFeatureAccessSnapshotUseCase } from "@/application/licensing/get-feature-access-snapshot-use-case";

import { IndexedDbMaterialRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-repository";
import { IndexedDbMaterialGroupRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-material-group-repository";
import { IndexedDbMachineRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-machine-repository";
import { IndexedDbToolRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-repository";
import { IndexedDbToolTypeRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-tool-type-repository";
import { IndexedDbExternalReferenceRepository } from "@/infrastructure/persistence/indexeddb/repositories/indexeddb-external-reference-repository";

import { IndexedDbRuleRepository } from "@/infrastructure/calculation-engine/indexeddb-rule-repository";
import { IndexedDbCalculationRepository } from "@/infrastructure/calculation-engine/indexeddb-calculation-repository";
import { IndexedDbMaterialProfileRepository } from "@/infrastructure/calculation-engine/indexeddb-material-profile-repository";
import { IndexedDbMachineProfileRepository } from "@/infrastructure/calculation-engine/indexeddb-machine-profile-repository";
import { IndexedDbToolProfileRepository } from "@/infrastructure/calculation-engine/indexeddb-tool-profile-repository";
import { IndexedDbCuttingConditionRepository } from "@/infrastructure/calculation-engine/indexeddb-cutting-condition-repository";
import { IndexedDbManualTimeStandardRepository } from "@/infrastructure/calculation-engine/indexeddb-manual-time-standard-repository";
import { IndexedDbInspectionEquipmentProfileRepository } from "@/infrastructure/calculation-engine/indexeddb-inspection-equipment-profile-repository";

import { IndexedDbActualTimeRecordRepository } from "@/infrastructure/calculation-engine/indexeddb-actual-time-record-repository";
import { IndexedDbActualTimeSegmentRepository } from "@/infrastructure/calculation-engine/indexeddb-actual-time-segment-repository";
import { IndexedDbActualTimeImportBatchRepository } from "@/infrastructure/calculation-engine/indexeddb-actual-time-import-batch-repository";
import { IndexedDbCalculationVarianceRepository } from "@/infrastructure/calculation-engine/indexeddb-calculation-variance-repository";
import { IndexedDbVarianceCauseRepository } from "@/infrastructure/calculation-engine/indexeddb-variance-cause-repository";
import { IndexedDbCalibrationSampleRepository } from "@/infrastructure/calculation-engine/indexeddb-calibration-sample-repository";
import { IndexedDbCalibrationProfileRepository } from "@/infrastructure/calculation-engine/indexeddb-calibration-profile-repository";
import { IndexedDbCalibrationProposalRepository } from "@/infrastructure/calculation-engine/indexeddb-calibration-proposal-repository";
import { IndexedDbShadowCalculationRepository } from "@/infrastructure/calculation-engine/indexeddb-shadow-calculation-repository";

import { IndexedDbCalculationDraftRepository } from "@/infrastructure/calculation-engine/indexeddb-calculation-draft-repository";
import { IndexedDbTechnologyOperationCalculationLinkRepository } from "@/infrastructure/calculation-engine/indexeddb-technology-operation-calculation-link-repository";
import { IndexedDbQuoteCalculationLinkRepository } from "@/infrastructure/calculation-engine/indexeddb-quote-calculation-link-repository";

import { InMemoryDomainEventPublisher } from "@/infrastructure/calculation-engine/in-memory-domain-event-publisher";
import { createCalculationEngineWithRegistry } from "@/infrastructure/calculation-engine/calculation-engine-factory";

import { MaterialProfileResolver } from "@/application/calculation-engine/resolvers/material-profile-resolver";
import { MachineProfileResolver } from "@/application/calculation-engine/resolvers/machine-profile-resolver";
import { ToolProfileResolver } from "@/application/calculation-engine/resolvers/tool-profile-resolver";
import { CuttingConditionResolverService } from "@/application/calculation-engine/resolvers/cutting-condition-resolver-service";
import { CalculationContextResolver } from "@/application/calculation-engine/resolvers/calculation-context-resolver";

import { TurningCalculationContextBuilder } from "@/application/calculation-engine/turning/turning-calculation-context-builder";
import { MillingCalculationContextBuilder } from "@/application/calculation-engine/milling/milling-calculation-context-builder";
import { GrindingCalculationContextBuilder } from "@/application/calculation-engine/grinding/grinding-calculation-context-builder";
import { ManualOperationCalculationContextBuilder } from "@/application/calculation-engine/manual/manual-operation-calculation-context-builder";
import { InspectionCalculationContextBuilder } from "@/application/calculation-engine/inspection/inspection-calculation-context-builder";

import { ResolveCalculationContextUseCase } from "@/application/calculation-engine/use-cases/resolve-calculation-context-use-case";
import { ResolveCuttingConditionsUseCase } from "@/application/calculation-engine/use-cases/resolve-cutting-conditions-use-case";
import { ResolveMachineProfileUseCase } from "@/application/calculation-engine/use-cases/resolve-machine-profile-use-case";
import { ResolveMaterialProfileUseCase } from "@/application/calculation-engine/use-cases/resolve-material-profile-use-case";
import { ResolveToolProfileUseCase } from "@/application/calculation-engine/use-cases/resolve-tool-profile-use-case";
import { CompareMachineProfilesUseCase } from "@/application/calculation-engine/use-cases/compare-machine-profiles-use-case";
import { CompareToolProfilesUseCase } from "@/application/calculation-engine/use-cases/compare-tool-profiles-use-case";
import { CreateMachineProfileUseCase } from "@/application/calculation-engine/use-cases/create-machine-profile-use-case";
import { CreateMaterialProfileUseCase } from "@/application/calculation-engine/use-cases/create-material-profile-use-case";
import { CreateToolProfileUseCase } from "@/application/calculation-engine/use-cases/create-tool-profile-use-case";
import { CreateMachineCorrectionUseCase } from "@/application/calculation-engine/use-cases/create-machine-correction-use-case";
import { CreateMaterialCorrectionUseCase } from "@/application/calculation-engine/use-cases/create-material-correction-use-case";
import { CreateToolCorrectionUseCase } from "@/application/calculation-engine/use-cases/create-tool-correction-use-case";
import { UpdateMachineProfileUseCase } from "@/application/calculation-engine/use-cases/update-machine-profile-use-case";
import { UpdateMaterialProfileUseCase } from "@/application/calculation-engine/use-cases/update-material-profile-use-case";
import { UpdateToolProfileUseCase } from "@/application/calculation-engine/use-cases/update-tool-profile-use-case";
import { SaveCuttingConditionUseCase } from "@/application/calculation-engine/use-cases/save-cutting-condition-use-case";

import { CalculateTurningOperationUseCase } from "@/application/calculation-engine/turning/use-cases/calculate-turning-operation-use-case";
import { RecalculateTurningOperationUseCase } from "@/application/calculation-engine/turning/use-cases/recalculate-turning-operation-use-case";
import { ValidateTurningInputUseCase } from "@/application/calculation-engine/turning/use-cases/validate-turning-input-use-case";
import { CompareTurningMachinesUseCase } from "@/application/calculation-engine/turning/use-cases/compare-turning-machines-use-case";
import { CompareTurningToolsUseCase } from "@/application/calculation-engine/turning/use-cases/compare-turning-tools-use-case";

import { CalculateMillingOperationUseCase } from "@/application/calculation-engine/milling/use-cases/calculate-milling-operation-use-case";
import { RecalculateMillingOperationUseCase } from "@/application/calculation-engine/milling/use-cases/recalculate-milling-operation-use-case";
import { ValidateMillingInputUseCase } from "@/application/calculation-engine/milling/use-cases/validate-milling-input-use-case";
import { CompareMillingMachinesUseCase } from "@/application/calculation-engine/milling/use-cases/compare-milling-machines-use-case";
import { CompareMillingToolsUseCase } from "@/application/calculation-engine/milling/use-cases/compare-milling-tools-use-case";

import { CalculateCylindricalGrindingOperationUseCase } from "@/application/calculation-engine/grinding/use-cases/calculate-cylindrical-grinding-operation-use-case";
import { CalculateSurfaceGrindingOperationUseCase } from "@/application/calculation-engine/grinding/use-cases/calculate-surface-grinding-operation-use-case";
import { RecalculateGrindingOperationUseCase } from "@/application/calculation-engine/grinding/use-cases/recalculate-grinding-operation-use-case";
import { ValidateGrindingInputUseCase } from "@/application/calculation-engine/grinding/use-cases/validate-grinding-input-use-case";
import { CompareGrindingMachinesUseCase } from "@/application/calculation-engine/grinding/use-cases/compare-grinding-machines-use-case";
import { CompareGrindingWheelsUseCase } from "@/application/calculation-engine/grinding/use-cases/compare-grinding-wheels-use-case";

import { CalculateManualOperationUseCase } from "@/application/calculation-engine/manual/use-cases/calculate-manual-operation-use-case";
import { RecalculateManualOperationUseCase } from "@/application/calculation-engine/manual/use-cases/recalculate-manual-operation-use-case";
import { ValidateManualOperationInputUseCase } from "@/application/calculation-engine/manual/use-cases/validate-manual-operation-input-use-case";
import { CompareManualStandardsUseCase } from "@/application/calculation-engine/manual/use-cases/compare-manual-standards-use-case";

import { CalculateInspectionOperationUseCase } from "@/application/calculation-engine/inspection/use-cases/calculate-inspection-operation-use-case";
import { RecalculateInspectionOperationUseCase } from "@/application/calculation-engine/inspection/use-cases/recalculate-inspection-operation-use-case";
import { ValidateInspectionInputUseCase } from "@/application/calculation-engine/inspection/use-cases/validate-inspection-input-use-case";
import { CompareInspectionMethodsUseCase } from "@/application/calculation-engine/inspection/use-cases/compare-inspection-methods-use-case";

import { CreateActualTimeRecordUseCase } from "@/application/calculation-engine/calibration/use-cases/create-actual-time-record-use-case";
import { UpdateActualTimeRecordUseCase } from "@/application/calculation-engine/calibration/use-cases/update-actual-time-record-use-case";
import { ValidateActualTimeRecordUseCase } from "@/application/calculation-engine/calibration/use-cases/validate-actual-time-record-use-case";
import { ApproveActualTimeRecordUseCase } from "@/application/calculation-engine/calibration/use-cases/approve-actual-time-record-use-case";
import { NormalizeActualTimeUseCase } from "@/application/calculation-engine/calibration/use-cases/normalize-actual-time-use-case";
import { ImportActualTimesUseCase } from "@/application/calculation-engine/calibration/use-cases/import-actual-times-use-case";
import { MatchActualTimeToCalculationUseCase } from "@/application/calculation-engine/calibration/use-cases/match-actual-time-to-calculation-use-case";
import { ListActualTimeRecordsUseCase } from "@/application/calculation-engine/calibration/use-cases/list-actual-time-records-use-case";
import { GetActualTimeRecordUseCase } from "@/application/calculation-engine/calibration/use-cases/get-actual-time-record-use-case";
import { ListActualTimeImportMappingsUseCase } from "@/application/calculation-engine/calibration/use-cases/list-actual-time-import-mappings-use-case";
import { SaveActualTimeImportMappingUseCase } from "@/application/calculation-engine/calibration/use-cases/save-actual-time-import-mapping-use-case";
import { AnalyzeCalculationVarianceUseCase } from "@/application/calculation-engine/calibration/use-cases/analyze-calculation-variance-use-case";
import { AssignVarianceCauseUseCase } from "@/application/calculation-engine/calibration/use-cases/assign-variance-cause-use-case";
import { ConfirmVarianceCauseUseCase } from "@/application/calculation-engine/calibration/use-cases/confirm-variance-cause-use-case";
import { RejectVarianceCauseUseCase } from "@/application/calculation-engine/calibration/use-cases/reject-variance-cause-use-case";
import { ListHighVarianceOperationsUseCase } from "@/application/calculation-engine/calibration/use-cases/list-high-variance-operations-use-case";
import { CreateCalibrationSamplesUseCase } from "@/application/calculation-engine/calibration/use-cases/create-calibration-samples-use-case";
import { DetectCalibrationOutliersUseCase } from "@/application/calculation-engine/calibration/use-cases/detect-calibration-outliers-use-case";
import { GenerateCalibrationProposalUseCase } from "@/application/calculation-engine/calibration/use-cases/generate-calibration-proposal-use-case";
import { BacktestCalibrationProposalUseCase } from "@/application/calculation-engine/calibration/use-cases/backtest-calibration-proposal-use-case";
import { ReviewCalibrationProposalUseCase } from "@/application/calculation-engine/calibration/use-cases/review-calibration-proposal-use-case";
import { ApproveCalibrationProposalUseCase } from "@/application/calculation-engine/calibration/use-cases/approve-calibration-proposal-use-case";
import { ListCalibrationProposalsUseCase } from "@/application/calculation-engine/calibration/use-cases/list-calibration-proposals-use-case";
import { GetCalibrationProposalUseCase } from "@/application/calculation-engine/calibration/use-cases/get-calibration-proposal-use-case";
import { ActivateCalibrationProfileUseCase } from "@/application/calculation-engine/calibration/use-cases/activate-calibration-profile-use-case";
import { SupersedeCalibrationProfileUseCase } from "@/application/calculation-engine/calibration/use-cases/supersede-calibration-profile-use-case";
import { ResolveCalibrationProfileUseCase } from "@/application/calculation-engine/calibration/use-cases/resolve-calibration-profile-use-case";
import { RunCalibrationShadowModeUseCase } from "@/application/calculation-engine/calibration/use-cases/run-calibration-shadow-mode-use-case";

import { SaveCalculationDraftUseCase } from "@/application/calculation-engine/workflow/use-cases/save-calculation-draft-use-case";
import { GetCalculationDraftUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calculation-draft-use-case";
import { ListCalculationDraftsUseCase } from "@/application/calculation-engine/workflow/use-cases/list-calculation-drafts-use-case";
import { DeleteCalculationDraftUseCase } from "@/application/calculation-engine/workflow/use-cases/delete-calculation-draft-use-case";
import { PreviewCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/preview-calculation-use-case";
import { GetCalculationResultUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calculation-result-use-case";
import { ListCalculationResultsUseCase } from "@/application/calculation-engine/workflow/use-cases/list-calculation-results-use-case";
import { GetCalculationRevisionHistoryUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calculation-revision-history-use-case";
import { SubmitCalculationForReviewUseCase } from "@/application/calculation-engine/workflow/use-cases/submit-calculation-for-review-use-case";
import { ApproveCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/approve-calculation-use-case";
import { RejectCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/reject-calculation-use-case";
import { ArchiveCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/archive-calculation-use-case";
import { LinkCalculationToTechnologyOperationUseCase } from "@/application/calculation-engine/workflow/use-cases/link-calculation-to-technology-operation-use-case";
import { ListTechnologyOperationLinksForCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/list-technology-operation-links-for-calculation-use-case";
import { UnlinkCalculationFromTechnologyOperationUseCase } from "@/application/calculation-engine/workflow/use-cases/unlink-calculation-from-technology-operation-use-case";
import { CreatePlanningTimeInputUseCase } from "@/application/calculation-engine/workflow/use-cases/create-planning-time-input-use-case";
import { LinkCalculationToQuoteItemUseCase } from "@/application/calculation-engine/workflow/use-cases/link-calculation-to-quote-item-use-case";
import { GetMachineComparisonUseCase } from "@/application/calculation-engine/workflow/use-cases/get-machine-comparison-use-case";
import { GetToolComparisonUseCase } from "@/application/calculation-engine/workflow/use-cases/get-tool-comparison-use-case";
import { GetCalculationDashboardUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calculation-dashboard-use-case";
import { GetActualTimeDashboardUseCase } from "@/application/calculation-engine/workflow/use-cases/get-actual-time-dashboard-use-case";
import { GetVarianceDashboardUseCase } from "@/application/calculation-engine/workflow/use-cases/get-variance-dashboard-use-case";
import { GetCalibrationDashboardUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calibration-dashboard-use-case";
import { ExportCalculationReportUseCase } from "@/application/calculation-engine/workflow/use-cases/export-calculation-report-use-case";
import { ListMaterialProfilesUseCase } from "@/application/calculation-engine/workflow/use-cases/list-material-profiles-use-case";
import { ListMachineProfilesUseCase } from "@/application/calculation-engine/workflow/use-cases/list-machine-profiles-use-case";
import { ListToolProfilesUseCase } from "@/application/calculation-engine/workflow/use-cases/list-tool-profiles-use-case";
import { GetCalculationInputSnapshotUseCase } from "@/application/calculation-engine/workflow/use-cases/get-calculation-input-snapshot-use-case";
import { RunMachineComparisonFromCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/run-machine-comparison-from-calculation-use-case";
import { RunToolComparisonFromCalculationUseCase } from "@/application/calculation-engine/workflow/use-cases/run-tool-comparison-from-calculation-use-case";

/**
 * Jedna factory funkce pro CELÝ modul "Výpočty výroby" (AP-MCE-001 Fáze H
 * §1/§36) - stejný vzor jako `master-data-dependencies.ts`/`routing-sheet-
 * editor-dependencies.ts` (žádný DI kontejner v projektu). Volá se JEDNOU
 * přes `useMemo` v každé `/calculations/*` stránce.
 *
 * Skládá dohromady existující Fáze A-G Application vrstvu (beze změny) s
 * novými Fáze H use cases (drafty/preview/schvalování/vazby/dashboardy).
 */
export function createCalculationEngineDependencies() {
  const tenantContext = new LocalTenantContext();
  const tenantRepository = new IndexedDbTenantRepository();
  const licenseRepository = new IndexedDbLicenseRepository();
  const licenseProvider = new DevelopmentLicenseProvider(new LocalLicenseProvider(tenantContext, licenseRepository));
  const featureAccessService = new DefaultFeatureAccessService(tenantContext, tenantRepository, licenseProvider);
  const eventPublisher = new InMemoryDomainEventPublisher();

  const materialRepository = new IndexedDbMaterialRepository();
  const materialGroupRepository = new IndexedDbMaterialGroupRepository();
  const machineRepository = new IndexedDbMachineRepository();
  const toolRepository = new IndexedDbToolRepository();
  const toolTypeRepository = new IndexedDbToolTypeRepository();

  const externalReferenceRepository = new IndexedDbExternalReferenceRepository();
  const ruleRepository = new IndexedDbRuleRepository();
  const calculationRepository = new IndexedDbCalculationRepository();
  const materialProfileRepository = new IndexedDbMaterialProfileRepository(externalReferenceRepository);
  const machineProfileRepository = new IndexedDbMachineProfileRepository(externalReferenceRepository);
  const toolProfileRepository = new IndexedDbToolProfileRepository(externalReferenceRepository);
  const cuttingConditionRepository = new IndexedDbCuttingConditionRepository(externalReferenceRepository);
  const manualTimeStandardRepository = new IndexedDbManualTimeStandardRepository();
  const inspectionEquipmentProfileRepository = new IndexedDbInspectionEquipmentProfileRepository();

  const actualTimeRecordRepository = new IndexedDbActualTimeRecordRepository();
  const actualTimeSegmentRepository = new IndexedDbActualTimeSegmentRepository();
  const actualTimeImportBatchRepository = new IndexedDbActualTimeImportBatchRepository();
  const calculationVarianceRepository = new IndexedDbCalculationVarianceRepository();
  const varianceCauseRepository = new IndexedDbVarianceCauseRepository();
  const calibrationSampleRepository = new IndexedDbCalibrationSampleRepository();
  const calibrationProfileRepository = new IndexedDbCalibrationProfileRepository();
  const calibrationProposalRepository = new IndexedDbCalibrationProposalRepository();
  const shadowCalculationRepository = new IndexedDbShadowCalculationRepository();

  const draftRepository = new IndexedDbCalculationDraftRepository();
  const technologyOperationLinkRepository = new IndexedDbTechnologyOperationCalculationLinkRepository();
  const quoteCalculationLinkRepository = new IndexedDbQuoteCalculationLinkRepository();

  const { engine: calculationEngine, registry: strategyRegistry } = createCalculationEngineWithRegistry();

  const materialProfileResolver = new MaterialProfileResolver(materialProfileRepository);
  const machineProfileResolver = new MachineProfileResolver(machineProfileRepository);
  const toolProfileResolver = new ToolProfileResolver(toolProfileRepository);
  const cuttingConditionResolverService = new CuttingConditionResolverService(cuttingConditionRepository, materialProfileResolver, toolProfileResolver);
  const calculationContextResolver = new CalculationContextResolver(
    materialProfileResolver,
    machineProfileResolver,
    toolProfileResolver,
    cuttingConditionResolverService,
    ruleRepository,
    eventPublisher
  );

  const turningContextBuilder = new TurningCalculationContextBuilder(ruleRepository, materialProfileResolver, machineProfileRepository, toolProfileResolver, cuttingConditionResolverService);
  const millingContextBuilder = new MillingCalculationContextBuilder(ruleRepository, materialProfileResolver, machineProfileRepository, toolProfileResolver, cuttingConditionResolverService);
  const grindingContextBuilder = new GrindingCalculationContextBuilder(ruleRepository, materialProfileResolver, machineProfileRepository, toolProfileResolver, cuttingConditionResolverService);
  const manualContextBuilder = new ManualOperationCalculationContextBuilder(ruleRepository, manualTimeStandardRepository);
  const inspectionContextBuilder = new InspectionCalculationContextBuilder(ruleRepository, inspectionEquipmentProfileRepository);

  const compareTurningMachinesUseCase = new CompareTurningMachinesUseCase(tenantContext, turningContextBuilder, calculationEngine, featureAccessService, eventPublisher);
  const compareTurningToolsUseCase = new CompareTurningToolsUseCase(tenantContext, turningContextBuilder, calculationEngine, featureAccessService, eventPublisher);
  const compareMillingMachinesUseCase = new CompareMillingMachinesUseCase(tenantContext, millingContextBuilder, calculationEngine, featureAccessService, eventPublisher);
  const compareMillingToolsUseCase = new CompareMillingToolsUseCase(tenantContext, millingContextBuilder, calculationEngine, featureAccessService, eventPublisher);
  const compareGrindingMachinesUseCase = new CompareGrindingMachinesUseCase(tenantContext, grindingContextBuilder, calculationEngine, featureAccessService, eventPublisher);
  const compareGrindingWheelsUseCase = new CompareGrindingWheelsUseCase(tenantContext, grindingContextBuilder, calculationEngine, featureAccessService, eventPublisher);

  const getMachineComparisonUseCase = new GetMachineComparisonUseCase(compareTurningMachinesUseCase, compareMillingMachinesUseCase, compareGrindingMachinesUseCase);
  const getToolComparisonUseCase = new GetToolComparisonUseCase(compareTurningToolsUseCase, compareMillingToolsUseCase, compareGrindingWheelsUseCase);

  return {
    tenantContext,
    featureAccessService,
    eventPublisher,
    calculationRepository,
    draftRepository,
    technologyOperationLinkRepository,
    quoteCalculationLinkRepository,
    actualTimeRecordRepository,
    actualTimeSegmentRepository,
    calibrationProfileRepository,
    calibrationProposalRepository,
    calibrationSampleRepository,
    calculationVarianceRepository,
    varianceCauseRepository,

    getFeatureAccessSnapshotUseCase: new GetFeatureAccessSnapshotUseCase(tenantContext, tenantRepository, featureAccessService),

    // --- Fáze B: resolvery/profily ---
    resolveCalculationContextUseCase: new ResolveCalculationContextUseCase(tenantContext, calculationContextResolver, featureAccessService),
    resolveCuttingConditionsUseCase: new ResolveCuttingConditionsUseCase(tenantContext, cuttingConditionResolverService, featureAccessService),
    resolveMachineProfileUseCase: new ResolveMachineProfileUseCase(tenantContext, machineProfileResolver, featureAccessService),
    resolveMaterialProfileUseCase: new ResolveMaterialProfileUseCase(tenantContext, materialProfileResolver, featureAccessService),
    resolveToolProfileUseCase: new ResolveToolProfileUseCase(tenantContext, toolProfileResolver, featureAccessService),
    compareMachineProfilesUseCase: new CompareMachineProfilesUseCase(tenantContext, machineProfileResolver, featureAccessService),
    compareToolProfilesUseCase: new CompareToolProfilesUseCase(tenantContext, toolProfileResolver, featureAccessService),
    createMachineProfileUseCase: new CreateMachineProfileUseCase(tenantContext, machineRepository, machineProfileRepository, featureAccessService, eventPublisher),
    createMaterialProfileUseCase: new CreateMaterialProfileUseCase(tenantContext, materialRepository, materialGroupRepository, materialProfileRepository, featureAccessService, eventPublisher),
    createToolProfileUseCase: new CreateToolProfileUseCase(tenantContext, toolRepository, toolTypeRepository, toolProfileRepository, featureAccessService, eventPublisher),
    createMachineCorrectionUseCase: new CreateMachineCorrectionUseCase(tenantContext, machineProfileRepository, featureAccessService, eventPublisher),
    createMaterialCorrectionUseCase: new CreateMaterialCorrectionUseCase(tenantContext, materialProfileRepository, featureAccessService, eventPublisher),
    createToolCorrectionUseCase: new CreateToolCorrectionUseCase(tenantContext, toolProfileRepository, featureAccessService, eventPublisher),
    updateMachineProfileUseCase: new UpdateMachineProfileUseCase(tenantContext, machineProfileRepository, featureAccessService, eventPublisher),
    updateMaterialProfileUseCase: new UpdateMaterialProfileUseCase(tenantContext, materialProfileRepository, featureAccessService, eventPublisher),
    updateToolProfileUseCase: new UpdateToolProfileUseCase(tenantContext, toolProfileRepository, featureAccessService, eventPublisher),
    saveCuttingConditionUseCase: new SaveCuttingConditionUseCase(tenantContext, cuttingConditionRepository, featureAccessService, eventPublisher),

    // --- Fáze C: turning ---
    calculateTurningOperationUseCase: new CalculateTurningOperationUseCase(
      tenantContext,
      calculationRepository,
      materialRepository,
      machineRepository,
      toolRepository,
      turningContextBuilder,
      calculationEngine,
      featureAccessService,
      eventPublisher
    ),
    recalculateTurningOperationUseCase: new RecalculateTurningOperationUseCase(tenantContext, calculationRepository, turningContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    validateTurningInputUseCase: new ValidateTurningInputUseCase(tenantContext, strategyRegistry, turningContextBuilder, featureAccessService),
    compareTurningMachinesUseCase,
    compareTurningToolsUseCase,

    // --- Fáze D: milling ---
    calculateMillingOperationUseCase: new CalculateMillingOperationUseCase(
      tenantContext,
      calculationRepository,
      materialRepository,
      machineRepository,
      toolRepository,
      millingContextBuilder,
      calculationEngine,
      featureAccessService,
      eventPublisher
    ),
    recalculateMillingOperationUseCase: new RecalculateMillingOperationUseCase(tenantContext, calculationRepository, millingContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    validateMillingInputUseCase: new ValidateMillingInputUseCase(tenantContext, strategyRegistry, millingContextBuilder, featureAccessService),
    compareMillingMachinesUseCase,
    compareMillingToolsUseCase,

    // --- Fáze E: grinding ---
    calculateCylindricalGrindingOperationUseCase: new CalculateCylindricalGrindingOperationUseCase(
      tenantContext,
      calculationRepository,
      materialRepository,
      machineRepository,
      toolRepository,
      grindingContextBuilder,
      calculationEngine,
      featureAccessService,
      eventPublisher
    ),
    calculateSurfaceGrindingOperationUseCase: new CalculateSurfaceGrindingOperationUseCase(
      tenantContext,
      calculationRepository,
      materialRepository,
      machineRepository,
      toolRepository,
      grindingContextBuilder,
      calculationEngine,
      featureAccessService,
      eventPublisher
    ),
    recalculateGrindingOperationUseCase: new RecalculateGrindingOperationUseCase(tenantContext, calculationRepository, grindingContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    validateGrindingInputUseCase: new ValidateGrindingInputUseCase(tenantContext, strategyRegistry, grindingContextBuilder, featureAccessService),
    compareGrindingMachinesUseCase,
    compareGrindingWheelsUseCase,

    // --- Fáze F: manual + inspection ---
    calculateManualOperationUseCase: new CalculateManualOperationUseCase(tenantContext, calculationRepository, materialRepository, manualContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    recalculateManualOperationUseCase: new RecalculateManualOperationUseCase(tenantContext, calculationRepository, manualContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    validateManualOperationInputUseCase: new ValidateManualOperationInputUseCase(tenantContext, strategyRegistry, manualContextBuilder, featureAccessService),
    compareManualStandardsUseCase: new CompareManualStandardsUseCase(tenantContext, manualTimeStandardRepository, featureAccessService),
    calculateInspectionOperationUseCase: new CalculateInspectionOperationUseCase(
      tenantContext,
      calculationRepository,
      materialRepository,
      inspectionContextBuilder,
      calculationEngine,
      featureAccessService,
      eventPublisher
    ),
    recalculateInspectionOperationUseCase: new RecalculateInspectionOperationUseCase(tenantContext, calculationRepository, inspectionContextBuilder, calculationEngine, featureAccessService, eventPublisher),
    validateInspectionInputUseCase: new ValidateInspectionInputUseCase(tenantContext, strategyRegistry, inspectionContextBuilder, featureAccessService),
    compareInspectionMethodsUseCase: new CompareInspectionMethodsUseCase(tenantContext, strategyRegistry, inspectionContextBuilder, featureAccessService),

    // --- Fáze G: skutečné časy / odchylky / kalibrace ---
    createActualTimeRecordUseCase: new CreateActualTimeRecordUseCase(tenantContext, actualTimeRecordRepository, featureAccessService, eventPublisher),
    updateActualTimeRecordUseCase: new UpdateActualTimeRecordUseCase(tenantContext, actualTimeRecordRepository, featureAccessService, eventPublisher),
    validateActualTimeRecordUseCase: new ValidateActualTimeRecordUseCase(tenantContext, actualTimeRecordRepository, actualTimeSegmentRepository, featureAccessService, eventPublisher),
    approveActualTimeRecordUseCase: new ApproveActualTimeRecordUseCase(tenantContext, actualTimeRecordRepository, featureAccessService, eventPublisher),
    normalizeActualTimeUseCase: new NormalizeActualTimeUseCase(tenantContext, actualTimeRecordRepository, actualTimeSegmentRepository, featureAccessService),
    importActualTimesUseCase: new ImportActualTimesUseCase(tenantContext, actualTimeImportBatchRepository, actualTimeRecordRepository, featureAccessService, eventPublisher),
    listActualTimeRecordsUseCase: new ListActualTimeRecordsUseCase(tenantContext, actualTimeRecordRepository, featureAccessService),
    getActualTimeRecordUseCase: new GetActualTimeRecordUseCase(tenantContext, actualTimeRecordRepository, featureAccessService),
    listActualTimeImportMappingsUseCase: new ListActualTimeImportMappingsUseCase(tenantContext, actualTimeImportBatchRepository, featureAccessService),
    saveActualTimeImportMappingUseCase: new SaveActualTimeImportMappingUseCase(tenantContext, actualTimeImportBatchRepository, featureAccessService),
    matchActualTimeToCalculationUseCase: new MatchActualTimeToCalculationUseCase(tenantContext, actualTimeRecordRepository, calculationRepository, featureAccessService, eventPublisher),
    analyzeCalculationVarianceUseCase: new AnalyzeCalculationVarianceUseCase(
      tenantContext,
      calculationRepository,
      actualTimeRecordRepository,
      actualTimeSegmentRepository,
      calculationVarianceRepository,
      featureAccessService,
      eventPublisher
    ),
    assignVarianceCauseUseCase: new AssignVarianceCauseUseCase(tenantContext, calculationVarianceRepository, actualTimeRecordRepository, varianceCauseRepository, featureAccessService, eventPublisher),
    confirmVarianceCauseUseCase: new ConfirmVarianceCauseUseCase(tenantContext, varianceCauseRepository, featureAccessService, eventPublisher),
    rejectVarianceCauseUseCase: new RejectVarianceCauseUseCase(tenantContext, varianceCauseRepository, featureAccessService),
    listHighVarianceOperationsUseCase: new ListHighVarianceOperationsUseCase(tenantContext, calculationVarianceRepository, featureAccessService),
    createCalibrationSamplesUseCase: new CreateCalibrationSamplesUseCase(tenantContext, calculationRepository, actualTimeRecordRepository, calibrationSampleRepository, featureAccessService, eventPublisher),
    detectCalibrationOutliersUseCase: new DetectCalibrationOutliersUseCase(tenantContext, calibrationSampleRepository, featureAccessService, eventPublisher),
    generateCalibrationProposalUseCase: new GenerateCalibrationProposalUseCase(tenantContext, calibrationSampleRepository, calibrationProfileRepository, calibrationProposalRepository, featureAccessService, eventPublisher),
    backtestCalibrationProposalUseCase: new BacktestCalibrationProposalUseCase(tenantContext, calibrationProposalRepository, calibrationSampleRepository, featureAccessService, eventPublisher),
    reviewCalibrationProposalUseCase: new ReviewCalibrationProposalUseCase(tenantContext, calibrationProposalRepository, featureAccessService, eventPublisher),
    approveCalibrationProposalUseCase: new ApproveCalibrationProposalUseCase(tenantContext, calibrationProposalRepository, featureAccessService, eventPublisher),
    listCalibrationProposalsUseCase: new ListCalibrationProposalsUseCase(tenantContext, calibrationProposalRepository, featureAccessService),
    getCalibrationProposalUseCase: new GetCalibrationProposalUseCase(tenantContext, calibrationProposalRepository, featureAccessService),
    activateCalibrationProfileUseCase: new ActivateCalibrationProfileUseCase(tenantContext, calibrationProposalRepository, calibrationProfileRepository, featureAccessService, eventPublisher),
    supersedeCalibrationProfileUseCase: new SupersedeCalibrationProfileUseCase(tenantContext, calibrationProfileRepository, featureAccessService, eventPublisher),
    resolveCalibrationProfileUseCase: new ResolveCalibrationProfileUseCase(tenantContext, calibrationProfileRepository, featureAccessService),
    runCalibrationShadowModeUseCase: new RunCalibrationShadowModeUseCase(tenantContext, calculationRepository, calibrationProfileRepository, shadowCalculationRepository, featureAccessService, eventPublisher),

    // --- Fáze H: drafty / preview / historie / schvalování / vazby / dashboardy ---
    saveCalculationDraftUseCase: new SaveCalculationDraftUseCase(tenantContext, draftRepository, featureAccessService, eventPublisher),
    getCalculationDraftUseCase: new GetCalculationDraftUseCase(tenantContext, draftRepository, featureAccessService),
    listCalculationDraftsUseCase: new ListCalculationDraftsUseCase(tenantContext, draftRepository, featureAccessService),
    deleteCalculationDraftUseCase: new DeleteCalculationDraftUseCase(tenantContext, draftRepository, featureAccessService, eventPublisher),
    previewCalculationUseCase: new PreviewCalculationUseCase(
      tenantContext,
      turningContextBuilder,
      millingContextBuilder,
      grindingContextBuilder,
      manualContextBuilder,
      inspectionContextBuilder,
      calculationEngine,
      featureAccessService
    ),
    getCalculationResultUseCase: new GetCalculationResultUseCase(tenantContext, calculationRepository, featureAccessService),
    listCalculationResultsUseCase: new ListCalculationResultsUseCase(tenantContext, calculationRepository, featureAccessService),
    getCalculationRevisionHistoryUseCase: new GetCalculationRevisionHistoryUseCase(tenantContext, calculationRepository, featureAccessService),
    submitCalculationForReviewUseCase: new SubmitCalculationForReviewUseCase(tenantContext, calculationRepository, featureAccessService, eventPublisher),
    approveCalculationUseCase: new ApproveCalculationUseCase(tenantContext, calculationRepository, featureAccessService, eventPublisher),
    rejectCalculationUseCase: new RejectCalculationUseCase(tenantContext, calculationRepository, featureAccessService, eventPublisher),
    archiveCalculationUseCase: new ArchiveCalculationUseCase(tenantContext, calculationRepository, featureAccessService, eventPublisher),
    linkCalculationToTechnologyOperationUseCase: new LinkCalculationToTechnologyOperationUseCase(tenantContext, calculationRepository, technologyOperationLinkRepository, featureAccessService, eventPublisher),
    listTechnologyOperationLinksForCalculationUseCase: new ListTechnologyOperationLinksForCalculationUseCase(tenantContext, technologyOperationLinkRepository, calculationRepository, featureAccessService),
    unlinkCalculationFromTechnologyOperationUseCase: new UnlinkCalculationFromTechnologyOperationUseCase(tenantContext, technologyOperationLinkRepository, featureAccessService, eventPublisher),
    createPlanningTimeInputUseCase: new CreatePlanningTimeInputUseCase(tenantContext, calculationRepository, featureAccessService),
    linkCalculationToQuoteItemUseCase: new LinkCalculationToQuoteItemUseCase(tenantContext, calculationRepository, quoteCalculationLinkRepository, featureAccessService, eventPublisher),
    getMachineComparisonUseCase,
    getToolComparisonUseCase,
    runMachineComparisonFromCalculationUseCase: new RunMachineComparisonFromCalculationUseCase(tenantContext, calculationRepository, featureAccessService, getMachineComparisonUseCase),
    runToolComparisonFromCalculationUseCase: new RunToolComparisonFromCalculationUseCase(tenantContext, calculationRepository, featureAccessService, getToolComparisonUseCase),
    listMaterialProfilesUseCase: new ListMaterialProfilesUseCase(tenantContext, materialProfileRepository, featureAccessService),
    listMachineProfilesUseCase: new ListMachineProfilesUseCase(tenantContext, machineProfileRepository, featureAccessService),
    listToolProfilesUseCase: new ListToolProfilesUseCase(tenantContext, toolProfileRepository, featureAccessService),
    getCalculationInputSnapshotUseCase: new GetCalculationInputSnapshotUseCase(tenantContext, calculationRepository, featureAccessService),
    getCalculationDashboardUseCase: new GetCalculationDashboardUseCase(
      tenantContext,
      calculationRepository,
      draftRepository,
      actualTimeRecordRepository,
      calculationVarianceRepository,
      calibrationProposalRepository,
      shadowCalculationRepository,
      featureAccessService
    ),
    getActualTimeDashboardUseCase: new GetActualTimeDashboardUseCase(tenantContext, actualTimeRecordRepository, featureAccessService),
    getVarianceDashboardUseCase: new GetVarianceDashboardUseCase(tenantContext, calculationVarianceRepository, varianceCauseRepository, featureAccessService),
    getCalibrationDashboardUseCase: new GetCalibrationDashboardUseCase(tenantContext, calibrationProfileRepository, calibrationProposalRepository, calibrationSampleRepository, shadowCalculationRepository, featureAccessService),
    exportCalculationReportUseCase: new ExportCalculationReportUseCase(tenantContext, calculationRepository, featureAccessService),
  };
}

export type CalculationEngineDependencies = ReturnType<typeof createCalculationEngineDependencies>;
