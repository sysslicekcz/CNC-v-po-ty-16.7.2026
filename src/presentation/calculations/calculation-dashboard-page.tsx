"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { OfflineStatusIndicator } from "./components/offline-status-indicator";
import { CalculationDashboardSummary } from "@/application/calculation-engine/workflow/use-cases/get-calculation-dashboard-use-case";
import { describeCalculationError } from "./calculation-error-messages";

interface QuickAction {
  label: string;
  href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "+ Nový výpočet", href: "/calculations/new" },
  { label: "Načíst operaci z postupu", href: "/calculations/new?source=technology_operation" },
  { label: "Porovnat stroje", href: "/calculations/compare-machines" },
  { label: "Importovat skutečné časy", href: "/calculations/actual-times/import" },
  { label: "Otevřít vysoké odchylky", href: "/calculations/variances" },
  { label: "Zkontrolovat návrhy kalibrací", href: "/calculations/calibration" },
];

/**
 * `CalculationDashboardPage` (AP-MCE-001 Fáze H §3) - vstupní bod modulu
 * "Výpočty výroby". Metriky NEPOČÍTÁ sama (§3) - vše čte z
 * `GetCalculationDashboardQuery`, jediné čtecí agregace v Application vrstvě.
 */
export function CalculationDashboardPage() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [summary, setSummary] = useState<CalculationDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() => deps.getCalculationDashboardUseCase.execute())
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeCalculationError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Výpočty výroby
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Přehled</h1>
            <p className="max-w-2xl text-sm text-muted">Manufacturing Calculation Engine - výpočty, skutečné časy, odchylky a kalibrace na jednom místě.</p>
          </div>
          <OfflineStatusIndicator />
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="rounded border border-accent px-3 py-2 text-left text-sm text-accent hover:bg-accent/10"
            >
              {action.label}
            </button>
          ))}
        </div>

        {!summary && !error && <p className="text-sm text-muted">Načítám přehled…</p>}

        {summary && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Rozpracované výpočty" value={summary.draftCount} href="/calculations/drafts" />
            <MetricCard label="Schválené výpočty" value={summary.approvedCount} href="/calculations/history" />
            <MetricCard label="Nízká confidence" value={summary.lowConfidenceCount} href="/calculations/history" tone={summary.lowConfidenceCount > 0 ? "warn" : undefined} />
            <MetricCard label="Kritické warningy" value={summary.criticalWarningCount} href="/calculations/history" tone={summary.criticalWarningCount > 0 ? "danger" : undefined} />
            <MetricCard label="Neporovnané skutečné časy" value={summary.unmatchedActualTimeCount} href="/calculations/actual-times" />
            <MetricCard label="Operace s vysokou odchylkou" value={summary.highVarianceOperationCount} href="/calculations/variances" tone={summary.highVarianceOperationCount > 0 ? "warn" : undefined} />
            <MetricCard label="Kalibrace čekající na schválení" value={summary.pendingCalibrationProposalCount} href="/calculations/calibration" tone={summary.pendingCalibrationProposalCount > 0 ? "warn" : undefined} />
            <MetricCard label="Aktivní shadow kalibrace" value={summary.activeShadowCalibrationCount} href="/calculations/calibration" />
          </div>
        )}

        {summary && summary.recentResults.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted">Poslední výpočty</h2>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-raised text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Kategorie</th>
                    <th className="px-3 py-2 text-left">Typ operace</th>
                    <th className="px-3 py-2 text-left">Stav</th>
                    <th className="px-3 py-2 text-right">Čas [min]</th>
                    <th className="px-3 py-2 text-right">Confidence</th>
                    <th className="px-3 py-2 text-left">Vypočteno</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentResults.map((r) => (
                    <tr
                      key={r.calculationId}
                      className="cursor-pointer border-t border-border hover:bg-surface-raised"
                      onClick={() => router.push(`/calculations/${r.calculationId}`)}
                    >
                      <td className="px-3 py-2">{r.operationCategory}</td>
                      <td className="px-3 py-2">{r.operationTypeId}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2 text-right tabular">{r.totalOperationTimeMinutes?.toFixed(1) ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular">{r.confidenceScore !== undefined ? `${Math.round(r.confidenceScore * 100)} %` : "—"}</td>
                      <td className="px-3 py-2 text-muted">{new Date(r.calculatedAt).toLocaleString("cs-CZ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, href, tone }: { label: string; value: number; href: string; tone?: "warn" | "danger" }) {
  const router = useRouter();
  const toneClass = tone === "danger" ? "text-danger" : tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <button onClick={() => router.push(href)} className="rounded-lg border border-border bg-surface p-4 text-left transition hover:border-accent hover:bg-surface-raised">
      <div className={`font-mono text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </button>
  );
}
