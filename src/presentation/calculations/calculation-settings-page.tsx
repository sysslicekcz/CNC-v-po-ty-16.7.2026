"use client";

import { useMemo, useState } from "react";
import { createCalculationEngineDependencies } from "./calculation-engine-dependencies";
import { useFeatureAccessSnapshot } from "@/presentation/routing-sheets/use-feature-access-snapshot";
import { ensureAppBootstrapped } from "@/presentation/bootstrap/ensure-app-bootstrapped";
import { CalculationsNav } from "./components/calculations-nav";
import { describeCalculationError } from "./calculation-error-messages";

/**
 * `ImportExportPage`/nastavení modulu (AP-MCE-001 Fáze H §24) - export
 * JEDNOHO výpočtu do JSON (`ExportCalculationReportUseCase`, Fáze H §124).
 * CSV/XLSX/PDF export `CalculationResult` NEEXISTUJE (žádná taková
 * infrastruktura pro tenhle typ dokumentu v projektu není, na rozdíl od
 * CSV importu skutečných časů, který VLASTNÍ parser má) - honestní
 * "Dostupné formáty: JSON" místo předstírání podpory, kterou appka nemá.
 */
export function CalculationSettingsPage() {
  const deps = useMemo(() => createCalculationEngineDependencies(), []);
  const snapshot = useFeatureAccessSnapshot(deps.getFeatureAccessSnapshotUseCase);

  const [calculationId, setCalculationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportJson() {
    setBusy(true);
    setError(null);
    try {
      await ensureAppBootstrapped();
      const report = await deps.exportCalculationReportUseCase.execute(calculationId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calculation-${calculationId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(describeCalculationError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <CalculationsNav snapshot={snapshot} />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 border-b border-border pb-6">
          <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Výpočty výroby
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Nastavení a export</h1>
        </header>

        {error && <p className="mb-6 rounded border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="rounded border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium text-muted">Export výpočtu</h3>
          <p className="mb-3 text-xs text-muted">Dostupný formát: JSON (kompletní report - vstupy, breakdown, snapshoty profilů). CSV/XLSX/PDF export tenhle typ dokumentu zatím nepodporuje.</p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm"
              placeholder="Id výpočtu"
              value={calculationId}
              onChange={(e) => setCalculationId(e.target.value)}
            />
            <button onClick={exportJson} disabled={busy || !calculationId.trim()} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-30">
              {busy ? "Exportuji…" : "Exportovat JSON"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
