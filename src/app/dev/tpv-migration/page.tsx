"use client";

// Minimální vývojářská stránka pro spuštění a kontrolu TPV migrace (Krok 3,
// zadání bod 18 - Varianta A: explicitní dev/admin akce, žádné automatické
// spuštění). Není nikde v hlavní navigaci appky odkazovaná. Neřeší styl ani UX -
// jen "spustit a přečíst report", jak zadání vyžaduje ("nevytvářej zatím
// rozsáhlé produkční UI").

import { useState } from "react";
import { runMigrationEngine } from "@/infrastructure/migration/migration-runner";
import { rollbackMigrationRun } from "@/infrastructure/migration/rollback";
import type { MigrationReport } from "@/infrastructure/migration/types";

export default function TpvMigrationDevPage() {
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<Record<string, number> | null>(null);

  const runMigration = async () => {
    setBusy(true);
    setRollbackResult(null);
    try {
      const result = await runMigrationEngine();
      setReport(result);
    } finally {
      setBusy(false);
    }
  };

  const runRollback = async () => {
    if (!report) return;
    setBusy(true);
    try {
      const deleted = await rollbackMigrationRun(report.migrationRunId);
      setRollbackResult(deleted);
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tpv-migration-report-${report.migrationRunId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 900 }}>
      <h1>TPV migrace (dev nástroj)</h1>
      <p>
        Převede stará data (customers/inquiries/parts/positions/partOperationRows/machines/toolRows) do nového TPV
        modelu (samostatná IndexedDB databáze &quot;cnc-tpv&quot;). Staré stores se nemažou ani nemění.
      </p>
      <button onClick={runMigration} disabled={busy}>
        {busy ? "Pracuji…" : "Spustit migraci"}
      </button>{" "}
      {report && (
        <>
          <button onClick={downloadReport}>Stáhnout report (JSON)</button>{" "}
          <button onClick={runRollback} disabled={busy}>
            Rollback tohoto běhu
          </button>
        </>
      )}
      {report && (
        <>
          <h2>
            Stav: {report.status} {report.validation.passed ? "✓ validace OK" : "✗ validace našla problém"}
          </h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, fontSize: 12 }}>
            {JSON.stringify(report, null, 2)}
          </pre>
        </>
      )}
      {rollbackResult && (
        <>
          <h2>Rollback proveden</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, fontSize: 12 }}>
            {JSON.stringify(rollbackResult, null, 2)}
          </pre>
        </>
      )}
    </div>
  );
}
