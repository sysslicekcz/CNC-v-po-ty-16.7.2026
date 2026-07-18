import { ExternalReference, ExternalReferenceEntityType } from "../integrations/external-reference";

/** Tenant-scoped. Jedna lokální entita může mít víc referencí (napříč
 *  různými `externalSystemId`) - `findByLocalEntity` proto vrací pole, ne
 *  nejvýš jeden záznam. */
export interface ExternalReferenceRepository {
  findById(id: string, tenantId: string): Promise<ExternalReference | null>;

  /** Všechny reference dané lokální entity, napříč všemi externími systémy. */
  findByLocalEntity(
    tenantId: string,
    localEntityType: ExternalReferenceEntityType,
    localEntityId: string
  ): Promise<ExternalReference[]>;

  /** Reference odpovídající konkrétnímu externímu záznamu - unikátnost se
   *  posuzuje jen v rámci `[externalSystemId, externalEntityType, externalId]`,
   *  ne globálně (stejné `externalId` smí existovat nezávisle ve dvou různých
   *  systémech). */
  findByExternalId(
    tenantId: string,
    externalSystemId: string,
    externalEntityType: string,
    externalId: string
  ): Promise<ExternalReference[]>;

  listByExternalSystem(tenantId: string, externalSystemId: string): Promise<ExternalReference[]>;

  save(reference: ExternalReference): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
