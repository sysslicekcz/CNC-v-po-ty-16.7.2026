"use client";

import { useState } from "react";
import { RoutingSheetEditorDto } from "@/application/routing-sheets/dto/routing-sheet-editor-dto";

export interface ReleaseRoutingSheetDialogProps {
  routingSheet: RoutingSheetEditorDto;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

/** Potvrzení před vydáním (zadání bod 28) - tlačítko "Vydat" je disabled při
 *  blokujících chybách, ALE use case validaci provede znovu (UI kontrola není
 *  bezpečnostní hranice, viz docs/adr/0021 z Kroku 3.5, stejný princip). */
export function ReleaseRoutingSheetDialog({ routingSheet, onConfirm, onCancel }: ReleaseRoutingSheetDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorCount = routingSheet.validationIssues.filter((i) => i.severity === "error").length;
  const warningCount = routingSheet.validationIssues.filter((i) => i.severity === "warning").length;
  const calculationsStale = routingSheet.operations.some((op) =>
    op.positions.some((p) => p.activities.some((a) => a.calculationStaleByResourceChange))
  );

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vydání se nezdařilo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium">Vydat technologický postup</h2>
        <p className="mb-3 text-sm text-muted">
          Vydáním se revize {routingSheet.revision} uzamkne proti přímým změnám. Pro další úpravy bude nutné vytvořit novou revizi.
        </p>
        <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Revize</dt>
          <dd>{routingSheet.revision}</dd>
          <dt className="text-muted">Počet operací</dt>
          <dd>{routingSheet.operations.length}</dd>
          <dt className="text-muted">Upozornění</dt>
          <dd>{warningCount}</dd>
          <dt className="text-muted">Blokující chyby</dt>
          <dd className={errorCount > 0 ? "text-danger" : ""}>{errorCount}</dd>
          <dt className="text-muted">Kalkulace aktuální</dt>
          <dd>{calculationsStale ? "Ne - zkontrolujte zastaralé výpočty" : "Ano"}</dd>
        </dl>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent">
            Zrušit
          </button>
          <button
            onClick={handleConfirm}
            disabled={errorCount > 0 || busy}
            className="rounded border border-ok px-3 py-1.5 text-sm text-ok hover:bg-ok/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Vydávám…" : "Vydat"}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface CreateRevisionDialogProps {
  currentRevision: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function CreateRevisionDialog({ currentRevision, onConfirm, onCancel }: CreateRevisionDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vytvoření revize se nezdařilo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium">Vytvořit novou revizi</h2>
        <p className="mb-3 text-sm text-muted">
          Vznikne nový draft (revize {currentRevision + 1}) jako kopie revize {currentRevision}. Revize {currentRevision} se archivuje.
        </p>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent">
            Zrušit
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {busy ? "Vytvářím…" : "Vytvořit revizi"}
          </button>
        </div>
      </div>
    </div>
  );
}
