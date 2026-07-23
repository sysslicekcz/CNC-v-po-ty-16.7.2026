"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createCalculationEngineDependencies, CalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError, describeCalculationIssue } from "./calculation-error-messages";

const CURRENT_USER_PLACEHOLDER = "lokální uživatel";

type NormalizedActualTime = Awaited<ReturnType<CalculationEngineDependencies["normalizeActualTimeUseCase"]["execute"]>>;
type ValidateOutput = Awaited<ReturnType<CalculationEngineDependencies["validateActualTimeRecordUseCase"]["execute"]>>;

/** `ActualTimeDetailPage` (AP-MCE-001 Fáze H §20) - detail JEDNOHO
 *  `ActualTimeRecord` + akce (validace/normalizace/schválení), stejný typ
 *  odvození jako u `TimeOverlapResolution` v Fázi G ("čte se přes
 *  `NormalizeActualTimeUseCase`, žádný přepočet v UI"). */
export function ActualTimeDetailPage({ actualTimeRecordId }: { actualTimeRecordId: string }) {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [normalized, setNormalized] = useState<NormalizedActualTime | null>(null);
  const [validation, setValidation] = useState<ValidateOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return ensureAppBootstrapped()
      .then(() => deps.getActualTimeRecordUseCase.execute(actualTimeRecordId))
      .then((r) => {
        setRecord(r);
        return deps.normalizeActualTimeUseCase.execute({ actualTimeRecordId });
      })
      .then(setNormalized)
      .catch((err) => setError(describeCalculationError(err)));
  }, [actualTimeRecordId, deps]);

  useEffect(() => {
    load();
  }, [load]);

  async function validate() {
    setBusy(true);
    setError(null);
    try {
      const result = await deps.validateActualTimeRecordUseCase.execute({ actualTimeRecordId });
      setValidation(result);
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
      await deps.approveActualTimeRecordUseCase.execute({ actualTimeRecordId, approvedBy: CURRENT_USER_PLACEHOLDER });
      await load();
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!record && !error) {
    return (
      <div>
        <CalculationsNav snapshot={snapshot} />
        <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted">Načítám…</div>
      </div>
    );
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Skutečný čas
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{record ? String(record.status) : ""}</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {record && (
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Kategorie" value={String(record.operationCategory)} />
            <Stat label="Ks hotovo / plán" value={`${record.quantityCompleted} / ${record.quantityPlanned}`} />
            <Stat label="Zmetky" value={String(record.quantityScrapped ?? 0)} />
            <Stat label="Výpočet" value={record.calculationId ? String(record.calculationId) : "nespárováno"} />
            <Stat label="Zdroj" value={String(record.sourceType)} />
            <Stat label="Confidence" value={`${Math.round(Number(record.confidence) * 100)} %`} />
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={validate} disabled={busy} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
            Validovat
          </button>
          <button onClick={approve} disabled={busy || record?.status === "approved"} className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:opacity-30">
            Schválit
          </button>
        </div>

        {validation && (
          <div className="mb-6 rounded border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-medium text-muted">Výsledek validace ({validation.status})</h3>
            {validation.issues.length === 0 && <p className="text-sm text-ok">Žádné nálezy.</p>}
            <ul className="space-y-1">
              {validation.issues.map((issue, i) => (
                <li key={i} className="text-xs text-muted">
                  {describeCalculationIssue(issue)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {normalized && (
          <div className="rounded border border-border bg-surface p-4">
            <h3 className="mb-3 text-sm font-medium text-muted">Normalizovaný čas (po vyřešení překryvů, Fáze G)</h3>
            <div className="grid gap-2 text-xs sm:grid-cols-3">
              <p>Uplynulý čas: {normalized.elapsedTimeMin.toFixed(2)} min</p>
              <p>Seřízení: {normalized.setupTimeMin.toFixed(2)} min</p>
              <p>Stroj (produktivní): {normalized.productiveMachineTimeMin.toFixed(2)} min</p>
              <p>Obsluha (produktivní): {normalized.productiveOperatorTimeMin.toFixed(2)} min</p>
              <p>Manipulace: {normalized.handlingTimeMin.toFixed(2)} min</p>
              <p>Kontrola: {normalized.inspectionTimeMin.toFixed(2)} min</p>
              <p>Čekání: {normalized.waitingTimeMin.toFixed(2)} min</p>
              <p>Prostoj: {normalized.downtimeMin.toFixed(2)} min</p>
              <p>Přepracování: {normalized.reworkTimeMin.toFixed(2)} min</p>
              {normalized.goodPieceUnitTimeMin !== undefined && <p>Čas na dobrý kus: {normalized.goodPieceUnitTimeMin.toFixed(2)} min</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
