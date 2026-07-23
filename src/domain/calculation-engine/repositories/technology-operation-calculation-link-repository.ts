import { TechnologyOperationCalculationLink } from "../workflow/technology-operation-calculation-link";

/** Port pro `TechnologyOperationCalculationLink` (AP-MCE-001 Fáze H §17/§36). */
export interface TechnologyOperationCalculationLinkRepository {
  getById(id: string, tenantId: string): Promise<TechnologyOperationCalculationLink | null>;
  listByTechnologyOperation(technologyOperationId: string, tenantId: string): Promise<TechnologyOperationCalculationLink[]>;
  listByCalculation(calculationId: string, tenantId: string): Promise<TechnologyOperationCalculationLink[]>;
  save(link: TechnologyOperationCalculationLink): Promise<void>;
}
