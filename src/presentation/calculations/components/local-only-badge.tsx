/**
 * `LocalOnlyBadge` (AP-MCE-001 Fáze H §26) - appka nemá žádný synchronizační
 * backend (audit Fáze H §1 potvrdil, že v projektu neexistuje Planning
 * Engine ani serverová synchronizace - vše žije v IndexedDB v prohlížeči).
 * Tenhle štítek proto komunikuje upřímný, trvalý fakt ("data jsou jen v
 * tomhle prohlížeči"), NE dočasný stav "čeká na synchronizaci" (to by
 * předstíralo mechanismus, který appka nemá - viz `PendingSyncPanel`
 * poznámka ve finálním souhrnu Fáze H "zbývající rizika").
 */
export function LocalOnlyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted"
      title="Data tohoto výpočtu jsou uložená jen lokálně v tomto prohlížeči (IndexedDB) - appka nemá zapojený žádný synchronizační server."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muted" />
      Pouze lokálně
    </span>
  );
}
