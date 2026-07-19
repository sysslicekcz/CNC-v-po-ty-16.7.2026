"use client";

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Obecný potvrzovací dialog (Krok 5) - použitý pro deaktivaci/reaktivaci/
 *  smazání napříč VŠEMI kmenovými entitami, žádný samostatný dialog na
 *  entitu (stejné zdůvodnění jako `MasterDataStatusBadge`). */
export function ConfirmDialog({ title, message, confirmLabel = "Potvrdit", danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-sm font-medium">{title}</h2>
        <p className="mb-4 text-sm text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-border px-3 py-1.5 text-sm hover:bg-surface-raised">
            Zrušit
          </button>
          <button
            onClick={onConfirm}
            className={`rounded border px-3 py-1.5 text-sm ${
              danger ? "border-danger text-danger hover:bg-danger/10" : "border-accent text-accent hover:bg-accent/10"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
