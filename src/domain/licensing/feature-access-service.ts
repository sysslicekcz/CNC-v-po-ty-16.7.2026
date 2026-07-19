import { LicenseFeatureCode } from "./feature-code";
import { FeatureAccess } from "./feature-access";
import { LicenseLimitCode } from "./license-limit-code";

/**
 * Centrální kontrola "smí aktuální tenant tohle dělat" (Krok 3.5, bod 24).
 * Licence NESMÍ být kontrolována jen v UI - tohle rozhraní je určené pro
 * Application use casy (docs/adr/0021). Implementace musí ověřit aktivního
 * tenanta, existenci a stav licence, platnost, případnou grace period,
 * požadovanou funkci/režim přístupu a limit.
 *
 * `feature` přijímá i `ConnectorFeatureCode` (`connector.helios` apod.), takže
 * stejné rozhraní řídí jak obecné `integration.erp.*` funkce, tak dostupnost
 * jednotlivých konkrétních konektorů - beze změny tohoto kontraktu při
 * přidání nového konektoru.
 */
export interface FeatureAccessService {
  getAccess(feature: LicenseFeatureCode): Promise<FeatureAccess>;
  canUse(feature: LicenseFeatureCode, requiredAccess?: FeatureAccess): Promise<boolean>;
  require(feature: LicenseFeatureCode, requiredAccess?: FeatureAccess): Promise<void>;
  getLimit(limitCode: LicenseLimitCode): Promise<number | null>;
  assertWithinLimit(limitCode: LicenseLimitCode, nextValue: number): Promise<void>;
}
