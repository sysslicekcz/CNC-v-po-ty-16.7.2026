"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";
import { FeatureCode, FeatureCodes } from "@/domain/licensing/feature-code";
import { satisfiesAccess } from "@/domain/licensing/feature-access";

interface NavSection {
  href: string;
  label: string;
  feature?: FeatureCode;
}

const SECTIONS: NavSection[] = [
  { href: "/calculations", label: "Přehled" },
  { href: "/calculations/new", label: "Nový výpočet", feature: FeatureCodes.CalculationCreate },
  { href: "/calculations/drafts", label: "Rozpracované", feature: FeatureCodes.CalculationRead },
  { href: "/calculations/history", label: "Historie", feature: FeatureCodes.CalculationRead },
  { href: "/calculations/compare-machines", label: "Porovnání strojů", feature: FeatureCodes.CalculationRead },
  { href: "/calculations/compare-tools", label: "Porovnání nástrojů", feature: FeatureCodes.CalculationRead },
  { href: "/calculations/actual-times", label: "Skutečné časy", feature: FeatureCodes.CalculationActualTimeRead },
  { href: "/calculations/variances", label: "Analýza odchylek", feature: FeatureCodes.CalculationCalibrationRead },
  { href: "/calculations/calibration", label: "Kalibrace", feature: FeatureCodes.CalculationCalibrationRead },
  { href: "/calculations/profiles/materials", label: "Profily", feature: FeatureCodes.CalculationRead },
  { href: "/calculations/settings", label: "Nastavení", feature: FeatureCodes.CalculationAdmin },
];

/**
 * Horní navigace modulu "Výpočty výroby" (AP-MCE-001 Fáze H §2) - stejný
 * vzor jako `MasterDataNav`. Viditelnost položek řídí `FeatureAccessSnapshot`
 * (§2 "Nevykresluj nepřístupnou funkci jako aktivní tlačítko") - `snapshot ===
 * null` (ještě se načítá) zobrazí VŠECHNY položky, ať uživatel při prvním
 * vykreslení nevidí prázdnou lištu; jakmile se snapshot načte, nedostupné
 * položky zmizí. Backend/Application kontrola (`FeatureAccessService.require`
 * v každém use casu) zůstává jediná SKUTEČNÁ ochrana - tohle je jen UX.
 */
export function CalculationsNav({ snapshot }: { snapshot: FeatureAccessSnapshot | null }) {
  const pathname = usePathname();

  const visibleSections = SECTIONS.filter((section) => {
    if (!section.feature) return true;
    if (!snapshot) return true;
    return satisfiesAccess(snapshot.access[section.feature] ?? "none", "read");
  });

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border px-6 py-2 text-sm">
      {visibleSections.map((section) => {
        const isActive = section.href === "/calculations" ? pathname === section.href : pathname?.startsWith(section.href);
        return (
          <Link key={section.href} href={section.href} className={`rounded px-2 py-1 ${isActive ? "bg-surface-raised" : "text-muted hover:text-foreground"}`}>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
