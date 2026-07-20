import { MaterialProfile } from "../profiles/material-profile";
import { MaterialCorrection } from "../profiles/material-correction";
import { MaterialProfileSnapshot } from "../profiles/material-profile-snapshot";

/**
 * Tenant-scoped port pro `MaterialProfile` + jeho `MaterialCorrection`
 * (AP-MCE-001 Fáze B §7) - jeden repozitář pro obě entity, stejný důvod jako
 * `CalculationRepository` z Fáze A (`CalculationRequest`+`CalculationResult`
 * spolu vždy vznikají/čtou se v jedné transakci use casu). Žádná metoda nesmí
 * vrátit záznam jiného tenantId (docs/adr/0019).
 */
export interface MaterialProfileRepository {
  getById(id: string, tenantId: string): Promise<MaterialProfile | null>;
  findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<MaterialProfile | null>;
  listByTenant(tenantId: string): Promise<MaterialProfile[]>;
  save(profile: MaterialProfile): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  getVersion(id: string, tenantId: string): Promise<number | null>;
  /** Pohodlný obal nad `getById` + `MaterialProfileSnapshot.forMaterialProfile`
   *  pro ad-hoc dotaz "jak profil vypadá právě teď", bez nutnosti spouštět
   *  celý výpočet. */
  getSnapshot(id: string, tenantId: string): Promise<MaterialProfileSnapshot | null>;

  findCorrectionByProfileId(materialProfileId: string, tenantId: string): Promise<MaterialCorrection | null>;
  saveCorrection(correction: MaterialCorrection): Promise<void>;
}
