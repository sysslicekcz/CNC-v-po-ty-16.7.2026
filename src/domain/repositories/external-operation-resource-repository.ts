import { ExternalOperationResource } from "../entities/external-operation-resource";
import { ExternalResourceCode } from "../value-objects/external-resource-code";

export interface ExternalOperationResourceRepository {
  findById(id: string, tenantId: string): Promise<ExternalOperationResource | null>;
  findByCode(tenantId: string, code: ExternalResourceCode): Promise<ExternalOperationResource | null>;
  list(tenantId: string): Promise<ExternalOperationResource[]>;
  save(resource: ExternalOperationResource): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
