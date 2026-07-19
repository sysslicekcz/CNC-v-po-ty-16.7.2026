"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createRoutingSheetEditorDependencies } from "@/presentation/routing-sheets/routing-sheet-editor-dependencies";
import { createMasterDataDependencies } from "@/presentation/master-data/master-data-dependencies";
import { createIntegrationDependencies } from "@/presentation/integrations/integration-dependencies";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { FeatureAccessSnapshot } from "@/application/licensing/feature-access-snapshot";

interface CardDef {
  key: string;
  title: string;
  description: string;
  href: string;
  quickAction?: { label: string; href: string };
}

const CARDS: CardDef[] = [
  {
    key: "routingSheets",
    title: "Technologické postupy",
    description: "Editor operací, pozic a upnutí, výpočty strojních časů, vydávání revizí.",
    href: "/tpv/routing-sheets",
    quickAction: { label: "+ Nový postup", href: "/tpv/routing-sheets/new" },
  },
  {
    key: "machines",
    title: "Stroje",
    description: "Vlastní stroje, hodinové sazby, skupiny kapacity, vlastnosti.",
    href: "/tpv/master-data/machines",
  },
  {
    key: "materials",
    title: "Materiály",
    description: "Materiálové skupiny a materiály pro řezné podmínky.",
    href: "/tpv/master-data/materials",
  },
  {
    key: "tools",
    title: "Nástroje",
    description: "Nástroje a typy nástrojů s dynamickými parametry.",
    href: "/tpv/master-data/tools",
  },
  {
    key: "cooperations",
    title: "Kooperace",
    description: "Externí zpracování (tepelné zpracování, NDT, …) a dodavatelé.",
    href: "/tpv/master-data/cooperations",
  },
  {
    key: "operationTypes",
    title: "Typy operací",
    description: "Číselník typů operací a jejich požadavků na vlastnosti strojů.",
    href: "/tpv/master-data/operation-types",
  },
  {
    key: "erp",
    title: "ERP integrace",
    description: "Připojené externí systémy (ERP, MES, účetnictví, …).",
    href: "/tpv/integrations",
  },
  {
    key: "license",
    title: "Licence a dostupné funkce",
    description: "Přehled organizace a toho, co aktuální licence povoluje.",
    href: "/tpv/settings",
  },
];

type Counts = Record<string, number | null>;

/**
 * Hlavní dashboard TPV modulu (Krok 6 - integrace/UX dotažení). Dosud existoval
 * jen `/tpv/master-data` (přehled jedné podsekce) a `/tpv/routing-sheets`
 * (seznam) - `/tpv` samotné vracelo 404 a uživatel se do TPV modulu nemohl
 * dostat jinak než ruční úpravou URL. Tahle stránka je vstupní bod celého
 * modulu s reálnými počty položek (ne jen statické odkazy).
 */
export default function TpvDashboardPage() {
  const router = useRouter();
  const routingDeps = useMemo(() => createRoutingSheetEditorDependencies(), []);
  const masterDataDeps = useMemo(() => createMasterDataDependencies(), []);
  const integrationDeps = useMemo(() => createIntegrationDependencies(), []);

  const [counts, setCounts] = useState<Counts>({});
  const [snapshot, setSnapshot] = useState<FeatureAccessSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loaders: [string, () => Promise<unknown[]>][] = [
      ["routingSheets", () => routingDeps.listRoutingSheetsUseCase.execute()],
      ["machines", () => masterDataDeps.listMachinesUseCase.execute()],
      ["materials", () => masterDataDeps.listMaterialsUseCase.execute()],
      ["tools", () => masterDataDeps.listToolsUseCase.execute()],
      ["cooperations", () => masterDataDeps.listExternalOperationResourcesUseCase.execute()],
      ["operationTypes", () => masterDataDeps.listOperationTypesUseCase.execute()],
      ["erp", () => integrationDeps.listExternalSystemsUseCase.execute()],
    ];

    void ensureAppBootstrapped().then(() => {
      if (cancelled) return;

      for (const [key, load] of loaders) {
        load()
          .then((items) => {
            if (!cancelled) setCounts((prev) => ({ ...prev, [key]: items.length }));
          })
          .catch(() => {
            if (!cancelled) setCounts((prev) => ({ ...prev, [key]: null }));
          });
      }

      integrationDeps.getFeatureAccessSnapshotUseCase
        .execute()
        .then((result) => {
          if (!cancelled) setSnapshot(result);
        })
        .catch(() => {
          /* Licence se nepodařilo vyhodnotit - karta licence to zobrazí jako "—". */
        });
    });

    return () => {
      cancelled = true;
    };
  }, [routingDeps, masterDataDeps, integrationDeps]);

  const licenseSummary = useMemo(() => {
    if (!snapshot) return null;
    const values = Object.values(snapshot.access);
    const enabled = values.filter((a) => a !== "none").length;
    return { enabled, total: values.length };
  }, [snapshot]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-1 border-b border-border pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          TPV modul
        </div>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Přehled</h1>
        <p className="max-w-2xl text-sm text-muted">
          Vstupní bod technologické přípravy výroby - technologické postupy, kmenová data, ERP integrace a licence
          na jednom místě.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const count = card.key === "license" ? licenseSummary?.enabled ?? null : counts[card.key];
          const total = card.key === "license" ? licenseSummary?.total : undefined;
          return (
            <div
              key={card.key}
              role="link"
              tabIndex={0}
              onClick={() => router.push(card.href)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(card.href);
              }}
              className="flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-accent hover:bg-surface-raised"
            >
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Link href={card.href} className="font-medium hover:underline">
                    {card.title}
                  </Link>
                  {count !== null && count !== undefined && (
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs tabular text-muted">
                      {total !== undefined ? `${count}/${total}` : count}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{card.description}</p>
              </div>
              {card.quickAction && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(card.quickAction!.href);
                  }}
                  className="mt-3 w-fit rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10"
                >
                  {card.quickAction.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
