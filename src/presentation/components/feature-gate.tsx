"use client";

import { ReactNode } from "react";
import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";
import { resolveFeatureGateState } from "./feature-gate-logic";

export interface FeatureGateProps {
  /** `null` = snapshot se ještě načítá (viz GetFeatureAccessSnapshotUseCase). */
  snapshot: FeatureAccessSnapshot | null;
  feature: FeatureCode;
  requiredAccess?: FeatureAccess;
  /** Zobrazí se, když licence funkci nepovoluje (nebo nedostatečnou úrovní přístupu). */
  fallback?: ReactNode;
  /** Zobrazí se, dokud `snapshot` je `null`. */
  loading?: ReactNode;
  /** Zobrazí se, když se licenci nepodařilo vyhodnotit (`snapshot.licenseError`). Bez zadání spadne na `fallback`. */
  errorFallback?: ReactNode;
  children: ReactNode;
}

/**
 * ČISTĚ prezentační komponenta (Krok 3.5, bod 27) - rozhoduje se podle jednou
 * načteného `FeatureAccessSnapshot`, sama žádnou licenci nenačítá ani
 * nevyhodnocuje (to dělá GetFeatureAccessSnapshotUseCase + FeatureAccessService).
 * Rozhodovací logika je v `resolveFeatureGateState` (feature-gate-logic.ts),
 * aby šla otestovat bez React rendereru.
 *
 * DŮLEŽITÉ: schování tlačítka/sekce v UI NIKDY není jediná ochrana. Odpovídající
 * use case MUSÍ nezávisle volat `FeatureAccessService.require(...)`
 * (docs/adr/0021, docs/adr/0022) - FeatureGate jen zlepšuje UX (uživatel
 * nevidí akci, kterou stejně nemůže provést), nenahrazuje kontrolu v
 * Application vrstvě. I kdyby FeatureGate zmizel/měl chybu, use case pořád
 * odmítne neoprávněný požadavek.
 */
export function FeatureGate({
  snapshot,
  feature,
  requiredAccess = "read",
  fallback = null,
  loading = null,
  errorFallback,
  children,
}: FeatureGateProps) {
  const state = resolveFeatureGateState(snapshot, feature, requiredAccess);

  switch (state) {
    case "loading":
      return <>{loading}</>;
    case "error":
      return <>{errorFallback ?? fallback}</>;
    case "denied":
      return <>{fallback}</>;
    case "granted":
      return <>{children}</>;
  }
}
