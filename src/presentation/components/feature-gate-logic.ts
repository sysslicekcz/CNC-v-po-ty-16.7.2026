import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess, satisfiesAccess } from "@/domain/licensing/feature-access";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";

export type FeatureGateState = "loading" | "granted" | "denied" | "error";

/**
 * Čistá rozhodovací funkce vytažená z <FeatureGate/> (Krok 3.5, bod 27) -
 * testovatelná bez React rendereru/DOM. Projekt zatím nemá React testing
 * harness (žádné @testing-library/react/jsdom v devDependencies) - vytažení
 * logiky sem umožňuje plné pokrytí testy (loading/granted/denied/error) bez
 * nutnosti přidávat novou závislost jen kvůli jedné komponentě (viz
 * docs/step-3-5/known-limitations.md).
 */
export function resolveFeatureGateState(
  snapshot: FeatureAccessSnapshot | null,
  feature: FeatureCode,
  requiredAccess: FeatureAccess = "read"
): FeatureGateState {
  if (!snapshot) {
    return "loading";
  }
  if (snapshot.licenseError) {
    return "error";
  }
  const access = snapshot.access[feature] ?? "none";
  return satisfiesAccess(access, requiredAccess) ? "granted" : "denied";
}
