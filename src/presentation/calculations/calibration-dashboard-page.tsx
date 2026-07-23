"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";

const STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  reviewed: "Zkontrolováno",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  activated: "Aktivováno",
  superseded: "Nahrazeno",
};

/**
 * `CalibrationDashboardPage` (AP-MCE-001 Fáze H §22) - konsoliduje Samples/
 * Backtest/ShadowMode sub-stránky do metrik + seznamu návrhů (`Calibration
 * ProposalPage` detail otevírá backtest i aktivaci, viz `calibration-
 * proposal-detail-page.tsx`) - generování NOVÉHO návrhu (`Generate
 * CalibrationProposalUseCase`) vyžaduje volbu metody/koeficientů/rozsahu
 * profilu, pro kterou tahle MVP obrazovka zatím nemá bezpečné výchozí
 * hodnoty - zdokumentovaná mezera (viz finální souhrn), generování zůstává
 * na admin/skript úrovni, dokud nevznikne vlastní konfigurační krok.
 */
export function CalibrationDashboardPage() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [summary, setSummary] = useState<Awaited<ReturnType<typeof deps.getCalibrationDashboardUseCase.execute>> | null>(null);
  const [proposals, setProposals] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() => Promise.all([deps.getCalibrationDashboardUseCase.execute(), deps.listCalibrationProposalsUseCase.execute()]))
      .then(([s, p]) => {
        if (cancelled) return;
        setSummary(s);
        setProposals(p);
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
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Kalibrace</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {summary && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Aktivní profily" value={String(summary.activeProfileCount)} />
            <MetricCard label="Čekají na schválení" value={String(summary.proposalsAwaitingApprovalCount)} tone={summary.proposalsAwaitingApprovalCount > 0 ? "warn" : undefined} />
            <MetricCard label="Použitelné vzorky" value={String(summary.usableSampleCount)} />
            <MetricCard label="Podezřelé odlehlé hodnoty" value={String(summary.outlierSuspectedCount)} tone={summary.outlierSuspectedCount > 0 ? "warn" : undefined} />
            <MetricCard label="Profily čekající na revizi" value={String(summary.profilesAwaitingReviewCount)} />
            <MetricCard label="Nízká confidence profilů" value={String(summary.lowConfidenceProfileCount)} tone={summary.lowConfidenceProfileCount > 0 ? "warn" : undefined} />
            <MetricCard label="Shadow výsledky" value={String(summary.shadowResultCount)} />
          </div>
        )}

        <h2 className="mb-3 text-sm font-medium text-muted">Návrhy kalibrace</h2>
        {!proposals && !error && <p className="text-sm text-muted">Načítám…</p>}
        {proposals && proposals.length === 0 && <p className="text-sm text-muted">Žádné návrhy.</p>}

        {proposals && proposals.length > 0 && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Stav</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-left">Vytvořeno</th>
                  <th className="px-3 py-2 text-left">Autor</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={String(p.id)} className="cursor-pointer border-t border-border hover:bg-surface-raised" onClick={() => router.push(`/calculations/calibration/${p.id}`)}>
                    <td className="px-3 py-2">{STATUS_LABELS[String(p.status)] ?? String(p.status)}</td>
                    <td className="px-3 py-2 text-right tabular">{Math.round(Number(p.confidence) * 100)} %</td>
                    <td className="px-3 py-2 text-muted">{new Date(String(p.createdAt)).toLocaleString("cs-CZ")}</td>
                    <td className="px-3 py-2 text-muted">{String(p.createdBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className={`font-mono text-2xl font-semibold ${tone === "warn" ? "text-accent" : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
