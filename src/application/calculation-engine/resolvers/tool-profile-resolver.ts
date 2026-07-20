import { ToolProfileRepository } from "@/domain/calculation-engine/repositories/tool-profile-repository";
import { ToolProfile } from "@/domain/calculation-engine/profiles/tool-profile";
import { ToolCorrection } from "@/domain/calculation-engine/profiles/tool-correction";
import { resolveToolProfileOverlay } from "@/domain/calculation-engine/profiles/tool-profile-overlay";
import { ToolProfileSnapshot } from "@/domain/calculation-engine/profiles/tool-profile-snapshot";
import { ToolProfileNotFoundError } from "@/domain/calculation-engine/errors/profile-not-found-error";

export interface ResolvedToolProfile {
  resolved: ToolProfile;
  system: ToolProfile;
  correction?: ToolCorrection;
}

/** `ToolProfileResolver` (AP-MCE-001 Fáze B §6) - viz `MaterialProfileResolver`
 *  pro plné zdůvodnění vzoru. */
export class ToolProfileResolver {
  constructor(private readonly repository: ToolProfileRepository) {}

  async resolve(toolProfileId: string, tenantId: string): Promise<ResolvedToolProfile> {
    const system = await this.repository.getById(toolProfileId, tenantId);
    if (!system) throw new ToolProfileNotFoundError(toolProfileId, tenantId);

    const correction = await this.repository.findCorrectionByProfileId(toolProfileId, tenantId);
    const resolved = resolveToolProfileOverlay(system, correction ?? undefined);
    return { resolved, system, correction: correction ?? undefined };
  }

  async resolveSnapshot(toolProfileId: string, tenantId: string, createdAt: string): Promise<ToolProfileSnapshot> {
    const { resolved, system, correction } = await this.resolve(toolProfileId, tenantId);
    return ToolProfileSnapshot.forToolProfile(resolved, {
      systemVersion: system.recordVersion,
      correctionVersion: correction?.recordVersion,
      createdAt,
    });
  }

  /** AP-MCE-001 Fáze B §4 "porovnat nástroje" - stejný princip jako
   *  `MachineProfileResolver.resolveMany`. */
  async resolveMany(toolProfileIds: readonly string[], tenantId: string): Promise<ResolvedToolProfile[]> {
    return Promise.all(toolProfileIds.map((id) => this.resolve(id, tenantId)));
  }
}
