import { MachineProfile } from "../profiles/machine-profile";
import { MachineCorrection } from "../profiles/machine-correction";
import { MachineProfileSnapshot } from "../profiles/machine-profile-snapshot";

/**
 * Tenant-scoped port pro `MachineProfile` + jeho `MachineCorrection`
 * (AP-MCE-001 Fáze B §7) - stejný tvar jako `MaterialProfileRepository`.
 * Žádná metoda nesmí vrátit záznam jiného tenantId (docs/adr/0019).
 */
export interface MachineProfileRepository {
  getById(id: string, tenantId: string): Promise<MachineProfile | null>;
  findByExternalReference(externalSystemId: string, externalId: string, tenantId: string): Promise<MachineProfile | null>;
  listByTenant(tenantId: string): Promise<MachineProfile[]>;
  save(profile: MachineProfile): Promise<void>;
  archive(id: string, tenantId: string, archivedAt: string): Promise<void>;
  getVersion(id: string, tenantId: string): Promise<number | null>;
  getSnapshot(id: string, tenantId: string): Promise<MachineProfileSnapshot | null>;

  findCorrectionByProfileId(machineProfileId: string, tenantId: string): Promise<MachineCorrection | null>;
  saveCorrection(correction: MachineCorrection): Promise<void>;
}
