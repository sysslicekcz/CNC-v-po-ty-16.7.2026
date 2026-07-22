import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeRecordRepository } from "@/domain/calculation-engine/repositories/actual-time-record-repository";
import { ActualTimeImportBatchRepository } from "@/domain/calculation-engine/repositories/actual-time-import-batch-repository";
import { ActualTimeRecord } from "@/domain/calculation-engine/calibration/actual-time-record";
import { ActualTimeImportBatch, ActualTimeImportRow } from "@/domain/calculation-engine/calibration/actual-time-import";
import { runActualTimeImport } from "@/domain/calculation-engine/calibration/actual-time-import-service";
import { CalculationError } from "@/domain/calculation-engine/errors/calculation-error";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { DomainEventPublisher } from "@/domain/calculation-engine/events/domain-event-publisher";
import { buildCalculationEngineEvent } from "@/domain/calculation-engine/events/build-calculation-engine-event";

export interface ImportActualTimesInput {
  mappingId: string;
  sourceFileName?: string;
  rows: ActualTimeImportRow[];
  operationCategory: import("@/domain/calculation-engine/enums/operation-category").OperationCategory;
  recordedBy: string;
  actorId?: string;
  correlationId?: string;
}

/**
 * `ImportActualTimesUseCase` (AP-MCE-001 Fáze G §5/§22) - jediné místo, kde
 * se `runActualTimeImport()` (Domain, čisté) SKUTEČNĚ zapíše - vytvoří
 * `ActualTimeImportBatch` + `ActualTimeRecord` (status `"draft"`) pro KAŽDÝ
 * validní řádek. Formát vstupu (CSV/XLSX/JSON) appku nezajímá - `rows` už
 * dorazily jako `ActualTimeImportRow[]` (Infrastructure parser, mimo tenhle
 * use case).
 */
export class ImportActualTimesUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly importBatchRepository: ActualTimeImportBatchRepository,
    private readonly actualTimeRecordRepository: ActualTimeRecordRepository,
    private readonly featureAccessService: FeatureAccessService,
    private readonly eventPublisher: DomainEventPublisher
  ) {}

  async execute(input: ImportActualTimesInput): Promise<{ batch: Record<string, unknown>; createdRecordIds: string[] }> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeCreate, "write");

    const mapping = await this.importBatchRepository.getMappingById(input.mappingId, tenantId);
    if (!mapping) throw new CalculationError(`ActualTimeImportMapping "${input.mappingId}" nebyl nalezen.`);

    const now = new Date().toISOString();
    const result = runActualTimeImport(input.rows, mapping);

    const createdRecordIds: string[] = [];
    for (const row of result.rows) {
      if (row.status !== "valid" || !row.mappedDraft) continue;
      const draft = row.mappedDraft;
      const record = ActualTimeRecord.create({
        id: crypto.randomUUID(),
        tenantId,
        externalReferences: [],
        operationCategory: input.operationCategory,
        machineId: draft.machineId as string | undefined,
        workstationId: draft.workstationId as string | undefined,
        employeeId: draft.employeeId as string | undefined,
        quantityPlanned: draft.quantityPlanned as number,
        quantityCompleted: draft.quantityCompleted as number,
        quantityScrapped: draft.quantityScrapped as number,
        productionStartedAt: draft.productionStartedAt as string | undefined,
        productionFinishedAt: draft.productionFinishedAt as string | undefined,
        totalElapsedTimeMin: draft.totalElapsedTimeMin as number | undefined,
        setupTimeMin: draft.setupTimeMin as number | undefined,
        machineTimeMin: draft.machineTimeMin as number | undefined,
        operatorTimeMin: draft.operatorTimeMin as number | undefined,
        downtimeMin: draft.downtimeMin as number | undefined,
        notes: draft.downtimeReason as string | undefined,
        sourceType: "imported",
        sourceSystem: mapping.externalSystemId,
        sourceRecordId: String(row.rowNumber),
        measurementMethod: "imported_summary",
        confidence: 0.8,
        status: "draft",
        recordedBy: input.recordedBy,
        recordedAt: now,
        recordVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
      await this.actualTimeRecordRepository.save(record);
      createdRecordIds.push(record.id);
    }

    const batch = ActualTimeImportBatch.create({
      id: crypto.randomUUID(),
      tenantId,
      mappingId: input.mappingId,
      sourceFormat: mapping.sourceFormat,
      sourceFileName: input.sourceFileName,
      totalRows: result.totalRows,
      validRows: result.validRowCount,
      invalidRows: result.invalidRowCount,
      importedRows: createdRecordIds.length,
      status: "completed",
      startedAt: now,
      finishedAt: now,
      createdBy: input.recordedBy,
      createdAt: now,
    });
    await this.importBatchRepository.save(batch);

    await this.eventPublisher.publish(
      buildCalculationEngineEvent({ type: "actual_time.imported", tenantId, entityId: batch.id, actorId: input.actorId, correlationId: input.correlationId })
    );

    return { batch: batch.toPlainObject(), createdRecordIds };
  }
}
