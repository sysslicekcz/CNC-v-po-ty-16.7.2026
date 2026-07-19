/**
 * Metadata dohledatelnosti k legacy záznamu, ze kterého migrace tenhle nový
 * záznam vytvořila. Existuje jen v perzistenci, ne v čisté doméně (zadání, bod 9).
 * `migrationRunId` umožňuje rollback - smaže jen záznamy vzniklé konkrétním během.
 */
export interface LegacyMetadata {
  legacySource?: string;
  legacyId?: string;
  migrationRunId?: string;
}
