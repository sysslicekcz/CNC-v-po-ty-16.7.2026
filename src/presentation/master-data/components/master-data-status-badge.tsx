"use client";

/** Sjednocený vizuál pro "aktivní"/"neaktivní" napříč VŠEMI kmenovými entitami
 *  Kroku 5 - vstupem je čistý `boolean`, ne konkrétní `MasterDataStatus`/
 *  `EntityStav`, takže funguje pro obě (dosud nesjednocené, viz
 *  docs/audits/step-5-audit.md) reprezentace stavu beze změny. */
export function MasterDataStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${
        active ? "border-ok text-ok" : "border-border text-muted"
      }`}
    >
      {active ? "Aktivní" : "Neaktivní"}
    </span>
  );
}
