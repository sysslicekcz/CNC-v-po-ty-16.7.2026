"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";
import { OperationCalculationOutput } from "@/application/calculation-engine/dto/operation-calculation-output";
import { CalculationRevisionEntry } from "@/application/calculation-engine/workflow/use-cases/get-calculation-revision-history-use-case";
import {
  TimeBreakdownChart,
  CoefficientBreakdownTable,
  ConfidenceBreakdownPanel,
  WarningPanel,
  FeatureBreakdownTable,
  ParameterSourceTable,
  ExplainCalculationPanel,
} from "./breakdown/breakdown-panels";

/** Žádný autentizační modul v projektu neexistuje - stejný zástupný
 *  identifikátor jako `NewCalculationWizard`. */
const CURRENT_USER_PLACEHOLDER = "lokální uživatel";

type ResultTab = "summary" | "breakdown" | "confidence" | "snapshots" | "history" | "audit";
const TABS: { key: ResultTab; label: string }[] = [
  { key: "summary", label: "Souhrn" },
  { key: "breakdown", label: "Breakdown" },
  { key: "confidence", label: "Confidence a warningy" },
  { key: "snapshots", label: "Snapshoty" },
  { key: "history", label: "Historie revizí" },
  { key: "audit", label: "Audit" },
];

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

/**
 * `CalculationResultPage` (AP-MCE-001 Fáze H §11/§14) - detail JEDNOHO
 * `CalculationResult`. Módy (§11: Souhrn/Breakdown/Parametry/Koeficienty/
 * Warningy/Confidence/Snapshoty/Historie revizí/Skutečné časy/Odchylky/
 * Audit) jsou tu konsolidované do šesti záložek (Skutečné časy/Odchylky mají
 * vlastní stránky navázané na `calculationId`, Fáze H úkoly #131/#132) -
 * ŽÁDNÝ mód nesmí schovávat aproximaci (§11), proto `ExplainCalculationPanel`
 * i `WarningPanel` zůstávají viditelné vždy v Souhrnu, ne až po prokliku.
 */
export function CalculationResultPage({ calculationId }: { calculationId: string }) {
  const router = useRouter();
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [tab, setTab] = useState<ResultTab>("summary");
  const [result, setResult] = useState<OperationCalculationOutput | null>(null);
  const [history, setHistory] = useState<CalculationRevisionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => deps.getCalculationResultUseCase.execute(calculationId))
      .then((loaded) => {
        setResult(loaded);
        if (loaded) return deps.getCalculationRevisionHistoryUseCase.execute(loaded.calculationRequestId);
        return null;
      })
      .then((entries) => {
        if (entries) setHistory(entries);
      })
      .catch((err) => setError(describeCalculationError(err)));
  }, [calculationId, deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: () => Promise<OperationCalculationOutput>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div>
        <CalculationsNav snapshot={snapshot} />
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-danger">{error}</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div>
        <CalculationsNav snapshot={snapshot} />
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted">Načítám…</div>
      </div>
    );
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {result.operationCategory ?? "Výpočet"} {result.operationTypeId ?? ""}
            </div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
              {STATUS_LABELS[result.status] ?? result.status}
            </h1>
          </div>
          <WorkflowActions result={result} busy={busy} onAction={runAction} deps={deps} onRequestReject={() => setShowRejectDialog(true)} />
        </header>

        {actionError && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</p>}

        {showRejectDialog && (
          <div className="mb-6 rounded border border-danger/40 bg-danger/5 p-4">
            <label className="mb-2 block text-xs text-muted">Důvod zamítnutí (povinné)</label>
            <textarea className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setShowRejectDialog(false)} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
                Zrušit
              </button>
              <button
                disabled={!rejectReason.trim() || busy}
                onClick={() =>
                  runAction(() => deps.rejectCalculationUseCase.execute({ calculationId, reviewedBy: CURRENT_USER_PLACEHOLDER, reason: rejectReason })).then(() => {
                    setShowRejectDialog(false);
                    setRejectReason("");
                  })
                }
                className="rounded border border-danger/50 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-30"
              >
                Zamítnout
              </button>
            </div>
          </div>
        )}

        <nav className="mb-6 flex flex-wrap gap-1 border-b border-border text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t px-3 py-1.5 ${tab === t.key ? "border-b-2 border-accent text-accent" : "text-muted hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "summary" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryStat label="Celkový čas" value={result.finalOperationTimeMinutes !== undefined ? `${result.finalOperationTimeMinutes.toFixed(2)} min` : "—"} />
              <SummaryStat label="Confidence" value={result.confidenceScore !== undefined ? `${Math.round(result.confidenceScore * 100)} %` : "—"} />
              <SummaryStat label="Vypočteno" value={new Date(result.calculatedAt).toLocaleString("cs-CZ")} />
            </div>
            <ExplainCalculationPanel status={result.status} finalOperationTimeMinutes={result.finalOperationTimeMinutes} confidenceScore={result.confidenceScore} issues={result.issues} />
            {result.rejectionReason && (
              <p className="rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">Důvod zamítnutí: {result.rejectionReason}</p>
            )}
          </div>
        )}

        {tab === "breakdown" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <TimeBreakdownChart breakdown={result.breakdown} />
            <CoefficientBreakdownTable breakdown={result.breakdown} />
            <div className="lg:col-span-2">
              <FeatureBreakdownTable breakdown={result.breakdown} category={result.operationCategory} />
            </div>
            <div className="lg:col-span-2">
              <ParameterSourceTable breakdown={result.breakdown} category={result.operationCategory} />
            </div>
          </div>
        )}

        {tab === "confidence" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <ConfidenceBreakdownPanel breakdown={result.breakdown} category={result.operationCategory} fallbackConfidenceScore={result.confidenceScore} />
            <WarningPanel issues={result.issues} />
          </div>
        )}

        {tab === "snapshots" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SnapshotPanel title="Materiál v okamžiku výpočtu" snapshot={result.materialProfileSnapshot} />
            <SnapshotPanel title="Stroj v okamžiku výpočtu" snapshot={result.machineProfileSnapshot} />
          </div>
        )}

        {tab === "history" && (
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Revize</th>
                  <th className="px-3 py-2 text-left">Stav</th>
                  <th className="px-3 py-2 text-right">Čas [min]</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                  <th className="px-3 py-2 text-left">Vypočteno</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((entry) => (
                  <tr
                    key={entry.calculationId}
                    className={`cursor-pointer border-t border-border hover:bg-surface-raised ${entry.calculationId === result.calculationId ? "bg-accent/10" : ""}`}
                    onClick={() => router.push(`/calculations/${entry.calculationId}`)}
                  >
                    <td className="px-3 py-2">#{entry.revision}</td>
                    <td className="px-3 py-2">{STATUS_LABELS[entry.status] ?? entry.status}</td>
                    <td className="px-3 py-2 text-right tabular">{entry.finalOperationTimeMinutes?.toFixed(2) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular">{entry.confidenceScore !== undefined ? `${Math.round(entry.confidenceScore * 100)} %` : "—"}</td>
                    <td className="px-3 py-2 text-muted">{new Date(entry.calculatedAt).toLocaleString("cs-CZ")}</td>
                  </tr>
                ))}
                {(!history || history.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                      Žádné revize.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "audit" && (
          <div className="rounded border border-border bg-surface p-4 text-sm">
            <p className="mb-2 font-medium">Auditní stopa</p>
            <ul className="space-y-1 text-xs text-muted">
              <li>Vypočteno: {new Date(result.calculatedAt).toLocaleString("cs-CZ")}</li>
              {result.reviewedAt && <li>Zkontrolováno: {new Date(result.reviewedAt).toLocaleString("cs-CZ")} ({result.reviewedBy})</li>}
              {result.archivedAt && <li>Archivováno: {new Date(result.archivedAt).toLocaleString("cs-CZ")}</li>}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Projekt zatím nemá generický auditní log (žádná samostatná `AuditEvent` entita) - tenhle přehled je proto omezený jen na časová razítka, která už `CalculationResult` sám nese, ne na
              úplnou historii akcí.
            </p>
          </div>
        )}

        {tab === "audit" && <TechnologyOperationLinkPanel calculationId={result.calculationId} deps={deps} />}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}

function SnapshotPanel({ title, snapshot }: { title: string; snapshot: Record<string, unknown> | undefined }) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-medium text-muted">{title}</h3>
      {!snapshot ? (
        <p className="text-sm text-muted">Pro tuto kategorii operace se snapshot profilu neukládá.</p>
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted">{JSON.stringify(snapshot, null, 2)}</pre>
      )}
    </div>
  );
}

function WorkflowActions({
  result,
  busy,
  onAction,
  deps,
  onRequestReject,
}: {
  result: OperationCalculationOutput;
  busy: boolean;
  onAction: (action: () => Promise<OperationCalculationOutput>) => void;
  deps: ReturnType<typeof createCalculationEngineDependencies>;
  onRequestReject: () => void;
}) {
  const btnClass = "rounded border px-3 py-1.5 text-sm disabled:opacity-30";
  return (
    <div className="flex flex-wrap gap-2">
      {(result.status === "completed" || result.status === "completed_with_warnings") && (
        <button
          disabled={busy}
          onClick={() => onAction(() => deps.submitCalculationForReviewUseCase.execute({ calculationId: result.calculationId }))}
          className={`${btnClass} border-accent text-accent hover:bg-accent/10`}
        >
          Odeslat ke kontrole
        </button>
      )}
      {result.status === "needs_review" && (
        <>
          <button
            disabled={busy}
            onClick={() => onAction(() => deps.approveCalculationUseCase.execute({ calculationId: result.calculationId, reviewedBy: CURRENT_USER_PLACEHOLDER }))}
            className={`${btnClass} border-ok text-ok hover:bg-ok/10`}
          >
            Schválit
          </button>
          <button disabled={busy} onClick={onRequestReject} className={`${btnClass} border-danger/50 text-danger hover:bg-danger/10`}>
            Zamítnout
          </button>
        </>
      )}
      {result.status !== "archived" && (
        <button
          disabled={busy}
          onClick={() => onAction(() => deps.archiveCalculationUseCase.execute({ calculationId: result.calculationId }))}
          className={`${btnClass} border-border hover:bg-surface-raised`}
        >
          Archivovat
        </button>
      )}
    </div>
  );
}

/** `TechnologyOperationLinkPanel` (AP-MCE-001 Fáze H §17) - propojení
 *  výpočtu s technologickou operací přes `TechnologyOperationCalculation
 *  Link` (NEsahá na `Operation`/`RoutingSheet`, respektuje "NEPŘEPISUJ HOTOVÉ
 *  STRATEGIE" - vazba je samostatná, doplňková entita). */
function TechnologyOperationLinkPanel({ calculationId, deps }: { calculationId: string; deps: ReturnType<typeof createCalculationEngineDependencies> }) {
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [technologyOperationId, setTechnologyOperationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    deps.listTechnologyOperationLinksForCalculationUseCase
      .execute(calculationId)
      .then(setLinks)
      .catch((err) => setError(describeCalculationError(err)));
  }, [calculationId, deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function link() {
    setBusy(true);
    setError(null);
    try {
      await deps.linkCalculationToTechnologyOperationUseCase.execute({ technologyOperationId, calculationId, linkedBy: CURRENT_USER_PLACEHOLDER });
      setTechnologyOperationId("");
      load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink(linkId: string) {
    setBusy(true);
    setError(null);
    try {
      await deps.unlinkCalculationFromTechnologyOperationUseCase.execute({ linkId });
      load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-border bg-surface p-4 text-sm">
      <p className="mb-2 font-medium">Propojení s technologickým postupem</p>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      {links.length === 0 && <p className="text-xs text-muted">Zatím nepropojeno s žádnou technologickou operací.</p>}
      <ul className="mb-3 space-y-1">
        {links.map((l) => (
          <li key={String(l.id)} className="flex items-center justify-between text-xs">
            <span>
              {String(l.technologyOperationId)} - {String(l.linkStatus)} (revize {String(l.calculationRevision)})
            </span>
            {l.linkStatus === "active" && (
              <button onClick={() => unlink(String(l.id))} disabled={busy} className="rounded border border-danger/50 px-2 py-0.5 text-xs text-danger hover:bg-danger/10">
                Odpojit
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
          placeholder="Id technologické operace"
          value={technologyOperationId}
          onChange={(e) => setTechnologyOperationId(e.target.value)}
        />
        <button onClick={link} disabled={busy || !technologyOperationId.trim()} className="rounded border border-accent px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-30">
          Propojit
        </button>
      </div>
    </div>
  );
}
