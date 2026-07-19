import { OperationType, OperationCategory, OperationTypeResourceRequirement } from "@/domain/entities/operation-type";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";

export interface CreateOperationTypeInput {
  kod: string;
  nazev: string;
  kategorie: OperationCategory;
  resourceRequirement: OperationTypeResourceRequirement;
  requiresSetupTime: boolean;
  requiresUnitTime: boolean;
  popis?: string;
}

/** Založení typu operace (Krok 5, zadání bod 12/27) - dřív jen seedovaný
 *  systémový číselník, od Kroku 5 skutečně editovatelná kmenová data. */
export class CreateOperationTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateOperationTypeInput): Promise<OperationType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesManage, "write");

    const currentCount = (await this.operationTypeRepository.list(tenantId)).length;
    await this.featureAccessService.assertWithinLimit("operationTypes.max", currentCount + 1);

    const existing = await this.operationTypeRepository.findByCode(tenantId, input.kod);
    if (existing) {
      throw new MasterDataCodeAlreadyExistsError("Typ operace", tenantId, input.kod);
    }

    const operationType = OperationType.create({
      id: crypto.randomUUID(),
      tenantId,
      kod: input.kod,
      nazev: input.nazev,
      kategorie: input.kategorie,
      resourceRequirement: input.resourceRequirement,
      requiresSetupTime: input.requiresSetupTime,
      requiresUnitTime: input.requiresUnitTime,
      stav: "aktivni",
      popis: input.popis,
    });
    await this.operationTypeRepository.save(operationType);
    return operationType;
  }
}
