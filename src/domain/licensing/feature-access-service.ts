import { FeatureCode } from "./feature-code";
import { FeatureAccess } from "./feature-access";
import { LicenseLimitCode } from "./license-limit-code";

/**
 * Centrální kontrola "smí aktuální tenant tohle dělat" (Krok 3.5, bod 24).
 * Licence NESMÍ být kontrolována jen v UI - tohle rozhraní je určené pro
 * Application use casy (docs/adr/0021). Implementace musí ověřit aktivního
 * tenanta, existenci a stav licence, platnost, případnou grace period,
 * požadovanou funkci/režim přístupu a limit.
 */
export interface FeatureAccessService {
  getAccess(feature: FeatureCode): Promise<FeatureAccess>;
  canUse(feature: FeatureCode, requiredAccess?: FeatureAccess): Promise<boolean>;
  require(feature: FeatureCode, requiredAccess?: FeatureAccess): Promise<void>;
  getLimit(limitCode: LicenseLimitCode): Promise<number | null>;
  assertWithinLimit(limitCode: LicenseLimitCode, nextValue: number): Promise<void>;
}
