"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { CalculationSummary } from "@/application/calculation-engine/dto/calculation-summary";

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká",
  completed: "Dokončeno",
  completed_with_warnings: "Dokončeno s upozorněními",
  failed: "Selhalo",
  superseded: "Nahrazeno novější revizí",
  needs_review: "Čeká na kontrolu",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  archived: "Archivováno",
};

const CATEGORY_OPTIONS = ["all", "turning", "milling", "grinding", "manual", "inspection"] as const;
const STATUS_OPTIONS = ["all", ...Object.keys(STATUS_LABELS)] as const;

/** `CalculationHistoryPage` (AP-MCE-001 Fáze H §11 "historie výpočtů") -
 *  filtr podle kategorie/stavu je čistě UI záležitost (`ListCalculation
 *  ResultsUseCase` vrací VŠECHNY položky pro tenanta, filtrování/třídění
 *  dělá tahle stránka nad odlehčeným `CalculationSummary[]`, ne přes
 *  repository). */
export function CalculationHistoryPage() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [summaries, setSummaries] = useState<CalculationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_OPTIONS)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  useEffect(() => {
    let cancelled = false;
    ensureAppBootstrapped()
      .then(() => deps.listCalculationResultsUseCase.execute())
      .then((result) => {
        if (!cancelled) setSummaries(result);
      })
      .catch((err) => {
        if (!cancelled) setError(describeCalculationError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const filtered = (summaries ?? []).filter((s) => (categoryFilter === "all" || s.operationCategory === categoryFilter) && (statusFilter === "all" || s.status === statusFilter));

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Historie výpočtů</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <select className="rounded border border-border bg-surface px-2 py-1" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Všechny kategorie" : c}
              </option>
            ))}
          </select>
          <select className="rounded border border-border bg-surface px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Všechny stavy" : (STATUS_LABELS[s] ?? s)}
              </option>
            ))}
          </select>
        </div>

        {!summaries && !error && <p className="text-sm text-muted">Načítám…</p>}
        {summaries && filtered.length === 0 && <p className="text-sm text-muted">Žádné výpočty neodpovídají filtru.</p>}

        {filtered.length > 0 && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Kategorie</th>
                  <th className="px-3 py-2 text-left">Typ operace</th>
                  <th className="px-3 py-2 text-left">Stav</th>
                  <th className="px-3 py-2 text-right">Čas [min]</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-left">Ruční přepis</th>
                  <th className="px-3 py-2 text-left">Vypočteno</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.calculationId} className="cursor-pointer border-t border-border hover:bg-surface-raised" onClick={() => router.push(`/calculations/${s.calculationId}`)}>
                    <td className="px-3 py-2">{s.operationCategory}</td>
                    <td className="px-3 py-2">{s.operationTypeId}</td>
                    <td className="px-3 py-2">{STATUS_LABELS[s.status] ?? s.status}</td>
                    <td className="px-3 py-2 text-right tabular">{s.totalOperationTimeMinutes?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular">{s.confidenceScore !== undefined ? `${Math.round(s.confidenceScore * 100)} %` : "—"}</td>
                    <td className="px-3 py-2 text-muted">{s.hasManualOverride ? "Ano" : "—"}</td>
                    <td className="px-3 py-2 text-muted">{new Date(s.calculatedAt).toLocaleString("cs-CZ")}</td>
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
