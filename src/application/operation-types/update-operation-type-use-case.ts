import { OperationType, OperationCategory, OperationTypeResourceRequirement } from "@/domain/entities/operation-type";
import { OperationTypeRepository } from "@/domain/repositories/operation-type-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { MasterDataCodeAlreadyExistsError } from "@/domain/errors/master-data-errors";
import { NotFoundError } from "@/domain/errors/not-found-error";

export interface UpdateOperationTypeInput {
  kod?: string;
  nazev?: string;
  kategorie?: OperationCategory;
  resourceRequirement?: OperationTypeResourceRequirement;
  requiresSetupTime?: boolean;
  requiresUnitTime?: boolean;
  popis?: string;
}

export class UpdateOperationTypeUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly operationTypeRepository: OperationTypeRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(id: string, changes: UpdateOperationTypeInput): Promise<OperationType> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.OperationTypesManage, "write");

    const operationType = await this.operationTypeRepository.findById(id, tenantId);
    if (!operationType) throw new NotFoundError("OperationType", id);

    if (changes.kod !== undefined && changes.kod !== operationType.kod) {
      const conflict = await this.operationTypeRepository.findByCode(tenantId, changes.kod);
      if (conflict) throw new MasterDataCodeAlreadyExistsError("Typ operace", tenantId, changes.kod);
      operationType.changeCode(changes.kod);
    }

    if (changes.nazev !== undefined) operationType.rename(changes.nazev);

    operationType.updateDetails({
      kategorie: changes.kategorie,
      resourceRequirement: changes.resourceRequirement,
      requiresSetupTime: changes.requiresSetupTime,
      requiresUnitTime: changes.requiresUnitTime,
      popis: changes.popis,
    });

    await this.operationTypeRepository.save(operationType);
    return operationType;
  }
}
