"use client";

import { useEffect } from "react";
import { useUndoDelete } from "@/lib/entities";

const AUTO_DISMISS_MS = 8000;

/** Toast "poslední smazané, obnovit" - žije jednou u kořene appky (viz CncApp.tsx),
 *  ať funguje bez ohledu na to, ze kterého seznamu mazání přišlo. */
export default function UndoToast() {
  const { entry, restore, dismiss } = useUndoDelete();

  useEffect(() => {
    if (!entry) return;
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss je stabilní, chceme reagovat jen na změnu entry
  }, [entry]);

  if (!entry) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm shadow-lg">
      <span>Smazáno: {entry.label}</span>
      <button
        onClick={restore}
        className="rounded-md border border-accent-dim px-2.5 py-1 font-medium text-accent transition hover:border-accent"
      >
        Vrátit zpět
      </button>
      <button onClick={dismiss} aria-label="Zavřít" className="text-muted transition hover:text-foreground">
        ✕
      </button>
    </div>
  );
}
