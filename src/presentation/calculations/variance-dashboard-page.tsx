"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";

/** Prezentačně-lokální tvar `CalculationVarianceAnalysis`/`VarianceMetric
 *  Result` (Fáze G) - presentation nesmí tenhle typ importovat přímo z
 *  `domain/calculation-engine` (Fáze B §16), proto lokální strukturální
 *  duplikát jen s poli, která tahle stránka skutečně čte - hodnoty samotné
 *  přicházejí beze změny z `ListHighVarianceOperationsUseCase`. */
interface VarianceMetricResultView {
  metric: string;
  percentageVariance: number;
  severity: string;
  comparable: boolean;
}
interface VarianceAnalysisView {
  calculationId: string;
  calculationRevision: number;
  actualTimeRecordId: string;
  metrics: VarianceMetricResultView[];
  analyzedAt: string;
}

/**
 * `VarianceDashboardPage` (AP-MCE-001 Fáze H §21) - konsoliduje `Variance
 * DashboardPage`/`HighVarianceOperationsTable`/`VarianceCauseReviewPanel` do
 * JEDNÉ stránky (řádek tabulky se rozbalí na detail příčiny) - samostatná
 * `VarianceDetailPage` by jen znovu načetla stejnou jednu analýzu bez
 * dalšího přínosu.
 */
export function VarianceDashboardPage() {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [summary, setSummary] = useState<Awaited<ReturnType<typeof deps.getVarianceDashboardUseCase.execute>> | null>(null);
  const [highVariance, setHighVariance] = useState<VarianceAnalysisView[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => Promise.all([deps.getVarianceDashboardUseCase.execute(), deps.listHighVarianceOperationsUseCase.execute()]))
      .then(([s, ops]) => {
        setSummary(s);
        setHighVariance(ops as unknown as VarianceAnalysisView[]);
      })
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function assignCause(analysis: VarianceAnalysisView) {
    setBusy(true);
    setError(null);
    try {
      await deps.assignVarianceCauseUseCase.execute({
        calculationId: analysis.calculationId,
        calculationRevision: analysis.calculationRevision,
        actualTimeRecordId: analysis.actualTimeRecordId,
      });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Analýza odchylek</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {summary && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Průměrná odchylka" value={`${summary.averagePercentageVariance.toFixed(1)} %`} />
            <MetricCard label="Medián odchylky" value={`${summary.medianPercentageVariance.toFixed(1)} %`} />
            <MetricCard label="Kritické operace" value={String(summary.criticalCount)} />
            <MetricCard label="Celkem analyzováno" value={String(summary.totalAnalyzedCount)} />
          </div>
        )}

        {summary && summary.mostFrequentConfirmedCauses.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-2 text-sm font-medium text-muted">Nejčastější potvrzené příčiny</h2>
            <ul className="flex flex-wrap gap-2">
              {summary.mostFrequentConfirmedCauses.map((c) => (
                <li key={c.causeCode} className="rounded-full border border-border px-3 py-1 text-xs">
                  {c.causeCode} ({c.count}×)
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2 className="mb-3 text-sm font-medium text-muted">Operace s vysokou odchylkou</h2>
        {!highVariance && !error && <p className="text-sm text-muted">Načítám…</p>}
        {highVariance && highVariance.length === 0 && <p className="text-sm text-muted">Žádné operace s vysokou odchylkou.</p>}

        <div className="space-y-2">
          {(highVariance ?? []).map((a) => {
            const key = `${a.calculationId}@${a.calculationRevision}`;
            return (
              <div key={key} className="rounded border border-border bg-surface">
                <button onClick={() => setExpanded(expanded === key ? null : key)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-surface-raised">
                  <span>
                    Výpočet {a.calculationId} (revize {a.calculationRevision})
                  </span>
                  <span className="text-muted">{new Date(a.analyzedAt).toLocaleDateString("cs-CZ")}</span>
                </button>
                {expanded === key && (
                  <div className="border-t border-border p-4">
                    <table className="mb-3 w-full text-xs">
                      <thead className="text-muted">
                        <tr>
                          <th className="px-2 py-1 text-left">Metrika</th>
                          <th className="px-2 py-1 text-right">Odchylka</th>
                          <th className="px-2 py-1 text-left">Závažnost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.metrics.map((m) => (
                          <tr key={m.metric} className="border-t border-border">
                            <td className="px-2 py-1">{m.metric}</td>
                            <td className="px-2 py-1 text-right tabular">{m.comparable ? `${m.percentageVariance.toFixed(1)} %` : "nesrovnatelné"}</td>
                            <td className={`px-2 py-1 ${m.severity === "critical" ? "text-danger" : m.severity === "high" ? "text-accent" : "text-muted"}`}>{m.severity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button onClick={() => assignCause(a)} disabled={busy} className="rounded border border-accent px-3 py-1.5 text-xs text-accent hover:bg-accent/10 disabled:opacity-30">
                      Navrhnout příčinu (klasifikátor)
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
