"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/tpv/master-data/machines", label: "Stroje" },
  { href: "/tpv/master-data/capacity-groups", label: "Skupiny kapacity" },
  { href: "/tpv/master-data/capabilities", label: "Typy vlastností" },
  { href: "/tpv/master-data/operation-types", label: "Typy operací" },
  { href: "/tpv/master-data/cooperations", label: "Kooperace" },
  { href: "/tpv/master-data/tools", label: "Nástroje" },
  { href: "/tpv/master-data/cutting-conditions", label: "Řezné podmínky" },
  { href: "/tpv/master-data/materials", label: "Materiály" },
];

/** Horní navigace mezi sekcemi kmenových dat (Krok 5) - jedna společná
 *  komponenta pro všechny `/tpv/master-data/*` stránky, žádná duplikace
 *  odkazů na každé stránce zvlášť. */
export function MasterDataNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border px-6 py-2 text-sm">
      <Link href="/tpv/master-data" className={`rounded px-2 py-1 ${pathname === "/tpv/master-data" ? "bg-surface-raised" : "text-muted hover:text-foreground"}`}>
        Přehled
      </Link>
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          className={`rounded px-2 py-1 ${pathname?.startsWith(section.href) ? "bg-surface-raised" : "text-muted hover:text-foreground"}`}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
