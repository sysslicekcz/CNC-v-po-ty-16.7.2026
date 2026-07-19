"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createIntegrationDependencies } from "@/presentation/integrations/integration-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { Tenant } from "@/domain/entities/tenant";
import { FeatureAccess } from "@/domain/licensing/feature-access";

const TENANT_STATUS_LABELS: Record<string, string> = {
  active: "Aktivní",
  trial: "Zkušební",
  suspended: "Pozastavená",
  inactive: "Neaktivní",
};

const ACCESS_LABELS: Record<FeatureAccess, string> = {
  none: "Nedostupné",
  read: "Jen čtení",
  write: "Čtení a úpravy",
  full: "Plný přístup",
};

const FEATURE_GROUP_LABELS: Record<string, string> = {
  routing: "Technologické postupy",
  calculations: "Výpočty",
  machines: "Stroje",
  tools: "Nástroje",
  cooperations: "Kooperace",
  operation_types: "Typy operací",
  cutting_conditions: "Řezné podmínky",
  materials: "Materiály",
  planning: "Plánování",
  integration: "ERP integrace",
};

function groupKey(featureCode: string): string {
  return featureCode.split(".")[0];
}

/**
 * Nastavení organizace (Krok 6 - integrace/UX dotažení). Zobrazuje reálná data
 * z `GetCurrentTenantUseCase` a `GetFeatureAccessSnapshotUseCase` (Krok 3.5) -
 * appka dosud neměla žádnou stránku, kde by uživatel viděl, pod jakou
 * organizací běží a co jeho licence povoluje, aniž by procházel kód.
 */
export default function SettingsPage() {
  const deps = useMemo(() => createIntegrationDependencies(), []);
  const featureAccessSnapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() => deps.getCurrentTenantUseCase.execute())
      .then((result) => {
        if (!cancelled) setTenant(result);
      })
      .catch((e) => {
        if (!cancelled) setTenantError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const groups = useMemo(() => {
    if (!featureAccessSnapshot) return [];
    const map = new Map<string, { code: string; access: FeatureAccess }[]>();
    for (const [code, access] of Object.entries(featureAccessSnapshot.access)) {
      const key = groupKey(code);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ code, access });
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [featureAccessSnapshot]);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium">Nastavení</h1>
            <p className="text-sm text-muted">Organizace a přehled dostupných funkcí podle aktuální licence.</p>
          </div>
          <Link href="/tpv" className="text-sm text-muted hover:text-accent">
            ← Přehled
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Organizace</h2>
          {tenantError && <p className="text-sm text-danger">{tenantError}</p>}
          {!tenant && !tenantError && <p className="text-sm text-muted">Načítám…</p>}
          {tenant && (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Název</dt>
              <dd>{tenant.name}</dd>
              <dt className="text-muted">Kód</dt>
              <dd>{tenant.code.toString()}</dd>
              <dt className="text-muted">Stav</dt>
              <dd>{TENANT_STATUS_LABELS[tenant.status] ?? tenant.status}</dd>
            </dl>
          )}
        </section>

        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Licence a dostupné funkce</h2>
          {featureAccessSnapshot?.licenseError && (
            <p className="mb-3 rounded border border-danger px-2 py-1.5 text-sm text-danger">{featureAccessSnapshot.licenseError}</p>
          )}
          {!featureAccessSnapshot && <p className="text-sm text-muted">Načítám…</p>}
          {featureAccessSnapshot && (
            <div className="space-y-4">
              {groups.map(([group, features]) => (
                <div key={group}>
                  <h3 className="mb-1.5 text-sm font-medium">{FEATURE_GROUP_LABELS[group] ?? group}</h3>
                  <ul className="divide-y divide-border/60 overflow-hidden rounded border border-border">
                    {features.map(({ code, access }) => (
                      <li key={code} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <span className="font-mono text-xs text-muted">{code}</span>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs ${
                            access === "none" ? "border-border text-muted" : "border-ok text-ok"
                          }`}
                        >
                          {ACCESS_LABELS[access]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
