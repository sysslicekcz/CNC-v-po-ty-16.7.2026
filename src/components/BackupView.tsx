"use client";

import { useState } from "react";
import { exportBackup, downloadBackup, parseBackupFile, restoreBackup, BackupBundle } from "@/lib/backup";

function pluralCz(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function summarize(bundle: BackupBundle): string {
  const customers = pluralCz(bundle.customers.length, "zákazník", "zákazníci", "zákazníků");
  const parts = pluralCz(bundle.parts.length, "díl", "díly", "dílů");
  return `${bundle.customers.length} ${customers}, ${bundle.parts.length} ${parts}`;
}

export default function BackupView() {
  const [status, setStatus] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [pendingBundle, setPendingBundle] = useState<BackupBundle | null>(null);

  const handleExport = async () => {
    const bundle = await exportBackup();
    downloadBackup(bundle);
    setStatusIsError(false);
    setStatus(`Záloha stažena (${summarize(bundle)}).`);
  };

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bundle = await parseBackupFile(file);
      setPendingBundle(bundle);
      setStatus(null);
    } catch (err) {
      setStatusIsError(true);
      setStatus(err instanceof Error ? err.message : "Soubor se nepodařilo přečíst.");
      setPendingBundle(null);
    }
  };

  const handleRestore = async () => {
    if (!pendingBundle) return;
    const datum = new Date(pendingBundle.exportedAt).toLocaleString("cs-CZ");
    if (
      !window.confirm(
        `Tímto se přepíší VŠECHNA aktuální data zálohou z ${datum} (${summarize(pendingBundle)}). Původní data v tomto prohlížeči budou nenávratně ztracena. Pokračovat?`
      )
    ) {
      return;
    }
    await restoreBackup(pendingBundle);
    setPendingBundle(null);
    window.location.reload();
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="mb-1 text-lg font-medium">Export dat</h2>
        <p className="mb-3 text-sm text-muted">
          Stáhne všechny zákazníky, poptávky, díly a katalog nástrojů jako jeden soubor.
        </p>
        <button
          onClick={handleExport}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent hover:text-accent"
        >
          Stáhnout zálohu
        </button>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-1 text-lg font-medium">Import ze zálohy</h2>
        <p className="mb-3 text-sm text-muted">
          Nahraje soubor se zálohou a <span className="text-danger">přepíše jím veškerá aktuální data</span> v
          tomto prohlížeči.
        </p>
        <input type="file" accept="application/json" onChange={handleFileChosen} className="text-sm" />
        {pendingBundle && (
          <div className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm">
            <div className="mb-3 text-muted">
              Záloha z {new Date(pendingBundle.exportedAt).toLocaleString("cs-CZ")}:{" "}
              <span className="text-foreground">
                {pendingBundle.customers.length} zákazníků, {pendingBundle.parts.length} dílů
              </span>
              .
            </div>
            <button
              onClick={handleRestore}
              className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white"
            >
              Obnovit ze zálohy (přepíše aktuální data)
            </button>
          </div>
        )}
      </div>

      {status && <p className={"text-sm " + (statusIsError ? "text-danger" : "text-muted")}>{status}</p>}
    </div>
  );
}
