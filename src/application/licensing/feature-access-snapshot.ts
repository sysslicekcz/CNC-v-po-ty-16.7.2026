import { FeatureCode } from "@/domain/licensing/feature-code";
import { FeatureAccess } from "@/domain/licensing/feature-access";

/**
 * Immutable DTO pro UI (FeatureGate a další) - jeden načtený snímek přístupu
 * ke všem funkcím appky (Krok 3.5, bod 27). UI si ho natáhne jednou (např. při
 * načtení stránky) a rozhoduje se podle něj, místo aby si každá komponenta
 * zvlášť volala FeatureAccessService. `licenseError`, pokud je vyplněné,
 * znamená, že licenci se nepodařilo vyhodnotit (tenant neaktivní, licence
 * vypršela/pozastavená apod.) - všechny funkce jsou pak konzervativně "none",
 * ale UI může chybu zobrazit místo tichého schování tlačítek.
 */
export interface FeatureAccessSnapshot {
  tenantId: string;
  tenantActive: boolean;
  access: Readonly<Record<FeatureCode, FeatureAccess>>;
  licenseError?: string;
}
