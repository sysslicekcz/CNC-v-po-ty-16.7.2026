"use client";

import { useEffect, useState } from "react";

/**
 * `OfflineStatusIndicator` (AP-MCE-001 Fáze H §26) - appka je LOKÁLNĚ-PRVNÍ
 * (IndexedDB, žádný server), audit Fáze H §1 potvrdil, že v projektu
 * neexistuje ŽÁDNÝ synchronizační backend. Tenhle indikátor proto ukazuje
 * jen upřímný, ověřitelný stav prohlížeče (`navigator.onLine`) - NEPŘEDSTÍRÁ
 * synchronizaci, která v appce není zapojená (viz `LocalOnlyBadge` vedle).
 */
export function OfflineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted" title="Prohlížeč hlásí připojení k internetu.">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        Online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-2 py-0.5 text-xs text-accent" title="Prohlížeč hlásí ztrátu připojení - appka pracuje dál lokálně.">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      Offline (pracuje se lokálně)
    </span>
  );
}
