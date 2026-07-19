"use client";

import Link from "next/link";
import { MasterDataNav } from "@/presentation/master-data/components/master-data-nav";

const SECTIONS = [
  { href: "/tpv/master-data/machines", label: "Stroje", description: "Vlastní stroje, hodinové sazby, kategorie, kapacitní skupiny." },
  { href: "/tpv/master-data/capacity-groups", label: "Skupiny kapacity", description: "Sdílená fyzická kapacita napříč více podnikovými kódy strojů." },
  { href: "/tpv/master-data/capabilities", label: "Typy vlastností", description: "Technický registr vlastností strojů (max. průměr, live tooling, …)." },
  { href: "/tpv/master-data/operation-types", label: "Typy operací", description: "Editovatelný číselník typů operací a jejich požadavků na vlastnosti." },
  { href: "/tpv/master-data/cooperations", label: "Kooperace", description: "Externí zpracování (tepelné zpracování, NDT, …) a dodavatelé." },
  { href: "/tpv/master-data/tools", label: "Nástroje", description: "Nástroje a typy nástrojů s dynamickými parametry." },
  { href: "/tpv/master-data/cutting-conditions", label: "Řezné podmínky", description: "Profily řezných podmínek nástroje na konkrétním stroji." },
  { href: "/tpv/master-data/materials", label: "Materiály", description: "Materiálové skupiny a materiály pro řezné podmínky." },
];

/** Landing stránka sekce kmenových dat (Krok 5) - jen přehled a odkazy, žádná
 *  vlastní logika. */
export default function MasterDataLandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-medium">Kmenová data TPV</h1>
        <p className="text-sm text-muted">Správa strojů, nástrojů, kooperací a dalších číselníků používaných v technologických postupech.</p>
      </div>
      <MasterDataNav />
      <div className="mx-auto grid w-full max-w-5xl gap-3 p-6 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded border border-border p-4 text-sm hover:border-accent hover:bg-surface-raised"
          >
            <div className="mb-1 font-medium">{section.label}</div>
            <div className="text-muted">{section.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
