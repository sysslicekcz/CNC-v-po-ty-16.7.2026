import { TenantContext } from "@/domain/services/tenant-context";
import { ActualTimeImportBatchRepository } from "@/domain/calculation-engine/repositories/actual-time-import-batch-repository";
import { ActualTimeImportMapping, ActualTimeImportMappingProps } from "@/domain/calculation-engine/calibration/actual-time-import";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";

export interface SaveActualTimeImportMappingInput extends Omit<ActualTimeImportMappingProps, "id" | "tenantId" | "createdAt" | "updatedAt"> {
  id?: string;
}

/** `SaveActualTimeImportMappingUseCase` (AP-MCE-001 Fáze H §20
 *  "ActualTimeImportWizard" krok "mapování sloupců") - Application vrstva
 *  dosud neměla ŽÁDNÝ use case, který by `ActualTimeImportMapping` vytvořil
 *  (Fáze G postavila jen čtení/spuštění importu, mapování se předpokládalo
 *  jako už existující admin konfigurace). */
export class SaveActualTimeImportMappingUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly importBatchRepository: ActualTimeImportBatchRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: SaveActualTimeImportMappingInput): Promise<Record<string, unknown>> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.CalculationActualTimeCreate, "write");

    const now = new Date().toISOString();
    const existing = input.id ? await this.importBatchRepository.getMappingById(input.id, tenantId) : null;

    const mapping = ActualTimeImportMapping.create({
      ...input,
      id: input.id ?? crypto.randomUUID(),
      tenantId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    await this.importBatchRepository.saveMapping(mapping);
    return mapping.toPlainObject();
  }
}
