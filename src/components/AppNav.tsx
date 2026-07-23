"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/tpv", label: "Přehled" },
  { href: "/", label: "CNC kalkulace", exact: true },
  { href: "/tpv/routing-sheets", label: "Technologické postupy" },
  { href: "/calculations", label: "Výpočty výroby" },
  { href: "/tpv/master-data", label: "Kmenová data" },
  { href: "/tpv/integrations", label: "Integrace ERP" },
  { href: "/tpv/settings", label: "Nastavení" },
];

function isActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

/** Hlavní aplikační navigace (Krok 6 - integrace/UX dotažení) - jediná
 *  společná lišta viditelná na VŠECH obrazovkách (CNC časovač i celý TPV
 *  modul), zapojená v root layoutu. Bez ní byly `/tpv/*` stránky dostupné
 *  jen ruční úpravou URL. */
export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
        <span className="mr-2 shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-accent">CNC / TPV</span>
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-2.5 py-1.5 text-sm transition ${
              isActive(pathname, item.href, item.exact)
                ? "bg-accent text-[#17130a] font-medium"
                : "text-muted hover:bg-surface-raised hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
