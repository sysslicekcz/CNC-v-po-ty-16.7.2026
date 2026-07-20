import { ToolProfile } from "../profiles/tool-profile";
import { ToolCorrection } from "../profiles/tool-correction";
import { ToolProfileSnapshot } from "../profiles/tool-profile-snapshot";

/**
 * Tenant-scoped port pro `ToolProfile` + jeho `ToolCorrection`
 * (AP-MCE-001 Fáze B §7) - stejný tvar jako `MaterialProfileRepository`.
 * Žádná metoda nesmí vrátit záznam jiného tenantId (docs/adr/0019).
 */
export interface ToolProfileRepository {
  getById(id: string, tenantId: string): Promise<ToolProfile | null>;
  findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<ToolProfile | null>;
  listByTenant(tenantId: string): Promise<ToolProfile[]>;
  save(profile: ToolProfile): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  getVersion(id: string, tenantId: string): Promise<number | null>;
  getSnapshot(id: string, tenantId: string): Promise<ToolProfileSnapshot | null>;

  findCorrectionByProfileId(toolProfileId: string, tenantId: string): Promise<ToolCorrection | null>;
  saveCorrection(correction: ToolCorrection): Promise<void>;
}
