import { ExternalSystem } from "@/domain/integrations/external-system";
import { ExternalSystemType } from "@/domain/integrations/external-system";
import { ExternalSystemRepository } from "@/domain/repositories/external-system-repository";
import { TenantContext } from "@/domain/services/tenant-context";
import { FeatureAccessService } from "@/domain/licensing/feature-access-service";
import { FeatureCodes } from "@/domain/licensing/feature-code";
import { ExternalSystemCodeAlreadyExistsError } from "@/domain/errors/external-system-code-already-exists-error";

export interface CreateExternalSystemInput {
  code: string;
  name: string;
  type: ExternalSystemType;
  connectorType: string;
}

/** Založení nového připojeného externího systému (ERP, MES, účetnictví, ...) -
 *  Krok 6 (integrace/UX dotažení), doména existuje od Kroku 3.5, jen dosud
 *  nebyla propojená se žádným use casem/UI. */
export class CreateExternalSystemUseCase {
  constructor(
    private readonly tenantContext: TenantContext,
    private readonly externalSystemRepository: ExternalSystemRepository,
    private readonly featureAccessService: FeatureAccessService
  ) {}

  async execute(input: CreateExternalSystemInput): Promise<ExternalSystem> {
    const tenantId = this.tenantContext.requireCurrentTenantId();
    await this.featureAccessService.require(FeatureCodes.IntegrationErpConfigure, "write");

    const existing = await this.externalSystemRepository.findByCode(tenantId, input.code);
    if (existing) throw new ExternalSystemCodeAlreadyExistsError(tenantId, input.code);

    const system = ExternalSystem.create({
      id: crypto.randomUUID(),
      tenantId,
      code: input.code,
      name: input.name,
      type: input.type,
      connectorType: input.connectorType,
      status: "active",
    });
    await this.externalSystemRepository.save(system);
    return system;
  }
}
