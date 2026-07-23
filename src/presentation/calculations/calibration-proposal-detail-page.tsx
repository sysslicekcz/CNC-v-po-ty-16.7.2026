"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";

const CURRENT_USER_PLACEHOLDER = "lokální uživatel";

/** `CalibrationProposalDetailPage` (AP-MCE-001 Fáze H §22) - konsoliduje
 *  review/backtest/activate do JEDNÉ stránky (samostatné `CalibrationBacktest
 *  Page`/`CalibrationShadowModePage` by tu jen duplikovaly stejný jeden
 *  návrh). */
export function CalibrationProposalDetailPage({ proposalId }: { proposalId: string }) {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [proposal, setProposal] = useState<Record<string, unknown> | null>(null);
  const [backtestResults, setBacktestResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileName, setProfileName] = useState("");

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => deps.getCalibrationProposalUseCase.execute(proposalId))
      .then(setProposal)
      .catch((err) => setError(describeCalculationError(err)));
  }, [proposalId, deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function review() {
    setBusy(true);
    setError(null);
    try {
      await deps.reviewCalibrationProposalUseCase.execute({ proposalId, reviewedBy: CURRENT_USER_PLACEHOLDER });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await deps.approveCalibrationProposalUseCase.execute({ proposalId, approvedBy: CURRENT_USER_PLACEHOLDER });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  async function backtest() {
    setBusy(true);
    setError(null);
    try {
      const result = await deps.backtestCalibrationProposalUseCase.execute({ proposalId, splitMethod: "sample_id_hash", trainingRatio: 0.7 });
      setBacktestResults(result.results as unknown as Record<string, unknown>[]);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!profileName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await deps.activateCalibrationProfileUseCase.execute({ proposalId, name: profileName, validFrom: new Date().toISOString(), activatedBy: CURRENT_USER_PLACEHOLDER });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!proposal && !error) {
    return (
      <div>
        <CalculationsNav snapshot={snapshot} />
        <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted">Načítám…</div>
      </div>
    );
  }

  const currentCoefficients = (proposal?.currentCoefficients as Record<string, number> | undefined) ?? {};
  const proposedCoefficients = (proposal?.proposedCoefficients as Record<string, number> | undefined) ?? {};
  const coefficientNames = Array.from(new Set([...Object.keys(currentCoefficients), ...Object.keys(proposedCoefficients)]));

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Kalibrace
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{proposal ? String(proposal.status) : ""}</h1>
          </div>
          {proposal && <span className="text-sm text-muted">Confidence: {Math.round(Number(proposal.confidence) * 100)} %</span>}
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={review} disabled={busy} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
            Zkontrolováno
          </button>
          <button onClick={approve} disabled={busy} className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:opacity-30">
            Schválit
          </button>
          <button onClick={backtest} disabled={busy} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised disabled:opacity-30">
            Backtest
          </button>
        </div>

        <div className="mb-6 overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Koeficient</th>
                <th className="px-3 py-2 text-right">Současný</th>
                <th className="px-3 py-2 text-right">Navrhovaný</th>
              </tr>
            </thead>
            <tbody>
              {coefficientNames.map((name) => (
                <tr key={name} className="border-t border-border">
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-right tabular">{currentCoefficients[name]?.toFixed(4) ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular font-medium text-accent">{proposedCoefficients[name]?.toFixed(4) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {backtestResults && (
          <div className="mb-6 rounded border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted">Výsledky backtestu</h3>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">{JSON.stringify(backtestResults, null, 2)}</pre>
          </div>
        )}

        {proposal?.status === "approved" && (
          <div className="rounded border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted">Aktivovat jako profil</h3>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm"
                placeholder="Název profilu"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
              />
              <button onClick={activate} disabled={busy || !profileName.trim()} className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:opacity-30">
                Aktivovat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
