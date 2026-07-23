"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { ActualTimeRecordSummary } from "@/application/calculation-engine/calibration/use-cases/list-actual-time-records-use-case";

const STATUS_LABELS: Record<string, string> = {
  draft: "Koncept",
  validated: "Validováno",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  superseded: "Nahrazeno",
  archived: "Archivováno",
};

/**
 * `ActualTimesPage` (AP-MCE-001 Fáze H §20) - seznam `ActualTimeRecord`.
 * Ruční spárování nedostalo samostatnou `ActualTimeMatchReviewPage` (§20) -
 * je to inline akce v tomhle seznamu (zadání id výpočtu + tlačítko),
 * konsolidace stejná jako u ostatních Fáze H stránek, kde by samostatná
 * stránka jen duplikovala tenhle seznam s jiným filtrem.
 */
export function ActualTimesPage() {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [records, setRecords] = useState<ActualTimeRecordSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchInputs, setMatchInputs] = useState<Record<string, string>>({});
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => deps.listActualTimeRecordsUseCase.execute())
      .then(setRecords)
      .catch((err) => setError(describeCalculationError(err)));
  }, [deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function match(id: string) {
    const manualCalculationId = matchInputs[id];
    if (!manualCalculationId?.trim()) return;
    try {
      await deps.matchActualTimeToCalculationUseCase.execute({ actualTimeRecordId: id, manualCalculationId });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    }
  }

  const visible = (records ?? []).filter((r) => !onlyUnmatched || !r.calculationId);

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
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Skutečné časy</h1>
          </div>
          <button onClick={() => router.push("/calculations/actual-times/import")} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10">
            + Importovat
          </button>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <label className="mb-4 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyUnmatched} onChange={(e) => setOnlyUnmatched(e.target.checked)} />
          Jen nespárované
        </label>

        {!records && !error && <p className="text-sm text-muted">Načítám…</p>}
        {records && visible.length === 0 && <p className="text-sm text-muted">Žádné záznamy.</p>}

        {visible.length > 0 && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Kategorie</th>
                  <th className="px-3 py-2 text-left">Stav</th>
                  <th className="px-3 py-2 text-left">Zdroj</th>
                  <th className="px-3 py-2 text-right">Ks hotovo</th>
                  <th className="px-3 py-2 text-right">Čas [min]</th>
                  <th className="px-3 py-2 text-left">Výpočet</th>
                  <th className="px-3 py-2 text-left">Zaznamenáno</th>
                  <th className="px-3 py-2 text-right">Akce</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2">{r.operationCategory}</td>
                    <td className="px-3 py-2">{STATUS_LABELS[r.status] ?? r.status}</td>
                    <td className="px-3 py-2 text-muted">{r.sourceType}</td>
                    <td className="px-3 py-2 text-right tabular">{r.quantityCompleted}</td>
                    <td className="px-3 py-2 text-right tabular">{r.totalElapsedTimeMin?.toFixed(1) ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.calculationId ?? (
                        <div className="flex items-center gap-1">
                          <input
                            className="w-32 rounded border border-border bg-surface px-1.5 py-0.5 text-xs"
                            placeholder="id výpočtu"
                            value={matchInputs[r.id] ?? ""}
                            onChange={(e) => setMatchInputs({ ...matchInputs, [r.id]: e.target.value })}
                          />
                          <button onClick={() => match(r.id)} className="rounded border border-accent px-1.5 py-0.5 text-xs text-accent hover:bg-accent/10">
                            Spárovat
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{new Date(r.recordedAt).toLocaleString("cs-CZ")}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => router.push(`/calculations/actual-times/${r.id}`)} className="rounded border border-border px-2 py-1 text-xs hover:bg-surface-raised">
                        Detail
                      </button>
                    </td>
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
