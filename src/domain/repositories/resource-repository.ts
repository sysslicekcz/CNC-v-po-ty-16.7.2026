import { Resource } from "../entities/resource";
import { Repository } from "./repository";

export interface ResourceRepository extends Repository<Resource> {
  findByType(resourceType: string): Promise<Resource[]>;
}

export interface ResourceCapabilityRepository {
  findByResourceId(resourceId: string): Promise<{ id: string; operationTypeId: string }[]>;
  supports(resourceId: string, operationTypeId: string): Promise<boolean>;
}
